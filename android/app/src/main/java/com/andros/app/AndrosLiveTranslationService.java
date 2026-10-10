package com.andros.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.provider.Settings;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.ScrollView;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.google.mlkit.nl.languageid.LanguageIdentification;
import com.google.mlkit.nl.languageid.LanguageIdentifier;
import com.google.mlkit.nl.translate.TranslateLanguage;
import com.google.mlkit.nl.translate.Translation;
import com.google.mlkit.nl.translate.Translator;
import com.google.mlkit.nl.translate.TranslatorOptions;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import java.nio.ByteBuffer;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * User-consented screen capture + on-device OCR/translation + floating overlay.
 * Captured frames are processed in memory and never written to disk.
 */
public final class AndrosLiveTranslationService extends Service {
    public static final String ACTION_START = "com.andros.app.action.START_LIVE_TRANSLATION";
    public static final String ACTION_STOP = "com.andros.app.action.STOP_LIVE_TRANSLATION";
    public static final String EXTRA_RESULT_CODE = "projection_result_code";
    public static final String EXTRA_RESULT_DATA = "projection_result_data";
    public static final String EXTRA_TARGET_LANGUAGE = "target_language";
    private static final String CHANNEL_ID = "andros_live_translation";
    private static final int NOTIFICATION_ID = 8042;
    private static volatile boolean running = false;

    private MediaProjection projection;
    private VirtualDisplay virtualDisplay;
    private ImageReader imageReader;
    private HandlerThread workerThread;
    private Handler worker;
    private WindowManager windowManager;
    private ViewHolder overlay;
    private TextRecognizer recognizer;
    private LanguageIdentifier languageIdentifier;
    private Translator translator;
    private String targetLanguage = "it";
    private final AtomicBoolean processing = new AtomicBoolean(false);
    private volatile String lastOriginal = "";
    private volatile String lastTranslation = "";
    private volatile long lastProcessedAt = 0L;
    private int screenWidth;
    private int screenHeight;
    private int screenDensity;
    private boolean stopped = false;

    private static final class ViewHolder {
        final ScrollView scroll;
        final TextView text;
        ViewHolder(ScrollView scroll, TextView text) { this.scroll = scroll; this.text = text; }
    }

    public static boolean isRunning() { return running; }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        languageIdentifier = LanguageIdentification.getClient();
        workerThread = new HandlerThread("AndrosScreenOCR");
        workerThread.start();
        worker = new Handler(workerThread.getLooper());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;
        if (ACTION_STOP.equals(intent.getAction())) {
            stopSelfSafely();
            return START_NOT_STICKY;
        }
        if (!ACTION_START.equals(intent.getAction())) return START_NOT_STICKY;
        if (!Settings.canDrawOverlays(this)) {
            stopSelfSafely();
            return START_NOT_STICKY;
        }
        targetLanguage = intent.getStringExtra(EXTRA_TARGET_LANGUAGE);
        if (targetLanguage == null || TranslateLanguage.fromLanguageTag(targetLanguage) == null) {
            targetLanguage = "it";
        }
        int resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, 0);
        Intent resultData;
        if (Build.VERSION.SDK_INT >= 33) {
            resultData = intent.getParcelableExtra(EXTRA_RESULT_DATA, Intent.class);
        } else {
            resultData = intent.getParcelableExtra(EXTRA_RESULT_DATA);
        }
        if (resultData == null || resultCode == 0) {
            stopSelfSafely();
            return START_NOT_STICKY;
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, buildNotification(),
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
            } else {
                startForeground(NOTIFICATION_ID, buildNotification());
            }
            MediaProjectionManager manager = (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
            projection = manager.getMediaProjection(resultCode, resultData);
            if (projection == null) {
                stopSelfSafely();
                return START_NOT_STICKY;
            }
            projection.registerCallback(new MediaProjection.Callback() {
                @Override public void onStop() { stopSelfSafely(); }
            }, worker);
            setupCapture();
            showOverlay("Andros Traduzione live\nInquadratura in analisi…");
            running = true;
        } catch (Exception exception) {
            stopSelfSafely();
        }
        return START_NOT_STICKY;
    }

    private void setupCapture() {
        android.util.DisplayMetrics metrics = new android.util.DisplayMetrics();
        if (Build.VERSION.SDK_INT >= 30) {
            android.view.Display display = getDisplay();
            if (display != null) display.getRealMetrics(metrics);
            else getSystemService(WindowManager.class).getDefaultDisplay().getRealMetrics(metrics);
        } else {
            windowManager.getDefaultDisplay().getRealMetrics(metrics);
        }
        screenWidth = Math.max(1, metrics.widthPixels);
        screenHeight = Math.max(1, metrics.heightPixels);
        screenDensity = metrics.densityDpi;
        imageReader = ImageReader.newInstance(screenWidth, screenHeight, PixelFormat.RGBA_8888, 2);
        virtualDisplay = projection.createVirtualDisplay(
            "AndrosLiveTranslation", screenWidth, screenHeight, screenDensity,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, imageReader.getSurface(), null, worker);
        imageReader.setOnImageAvailableListener(reader -> {
            if (stopped || !processing.compareAndSet(false, true)) return;
            Image image = null;
            try {
                image = reader.acquireLatestImage();
                if (image == null) { processing.set(false); return; }
                Bitmap bitmap = imageToBitmap(image);
                if (bitmap == null) { processing.set(false); return; }
                // Exclude the bottom quarter where Andros' own floating translation is drawn.
                int cropHeight = Math.max(1, (int) (bitmap.getHeight() * 0.76f));
                Bitmap crop = Bitmap.createBitmap(bitmap, 0, 0, bitmap.getWidth(), cropHeight);
                bitmap.recycle();
                processFrame(crop);
            } catch (Exception ignored) {
                processing.set(false);
            } finally {
                if (image != null) image.close();
            }
        }, worker);
    }

    private Bitmap imageToBitmap(Image image) {
        Image.Plane[] planes = image.getPlanes();
        if (planes == null || planes.length == 0) return null;
        ByteBuffer buffer = planes[0].getBuffer();
        int pixelStride = planes[0].getPixelStride();
        int rowStride = planes[0].getRowStride();
        int rowPadding = rowStride - pixelStride * image.getWidth();
        Bitmap padded = Bitmap.createBitmap(
            image.getWidth() + Math.max(0, rowPadding / Math.max(1, pixelStride)),
            image.getHeight(), Bitmap.Config.ARGB_8888);
        padded.copyPixelsFromBuffer(buffer);
        Bitmap cropped = Bitmap.createBitmap(padded, 0, 0, image.getWidth(), image.getHeight());
        padded.recycle();
        return cropped;
    }

    private void processFrame(Bitmap bitmap) {
        InputImage input = InputImage.fromBitmap(bitmap, 0);
        recognizer.process(input)
            .addOnSuccessListener(workerThread == null ? Runnable::run : worker::post, result -> {
                StringBuilder all = new StringBuilder();
                for (Text.TextBlock block : result.getTextBlocks()) {
                    String value = block.getText().trim();
                    if (!value.isEmpty() && !value.equals(lastTranslation)) {
                        if (all.length() > 0) all.append('\n');
                        all.append(value);
                    }
                    if (all.length() > 6000) break;
                }
                String original = all.toString().trim();
                if (original.isEmpty() || original.equals(lastOriginal)) {
                    bitmap.recycle();
                    processing.set(false);
                    return;
                }
                lastOriginal = original;
                identifyAndTranslate(original, bitmap);
            })
            .addOnFailureListener(error -> {
                bitmap.recycle();
                processing.set(false);
            });
    }

    private void identifyAndTranslate(String original, Bitmap bitmap) {
        languageIdentifier.identifyLanguage(original)
            .addOnSuccessListener(worker, detected -> {
                String source = detected == null || "und".equals(detected)
                    ? "en" : TranslateLanguage.fromLanguageTag(detected);
                String target = TranslateLanguage.fromLanguageTag(targetLanguage);
                if (source == null || target == null || source.equals(target)) {
                    if (source != null && source.equals(target)) updateOverlay(original);
                    bitmap.recycle();
                    processing.set(false);
                    return;
                }
                TranslatorOptions options = new TranslatorOptions.Builder()
                    .setSourceLanguage(source).setTargetLanguage(target).build();
                if (translator != null) translator.close();
                translator = Translation.getClient(options);
                translator.downloadModelIfNeeded()
                    .continueWithTask(task -> {
                        if (!task.isSuccessful()) throw task.getException();
                        return translator.translate(original);
                    })
                    .addOnSuccessListener(worker, translated -> {
                        lastTranslation = translated == null ? "" : translated;
                        lastProcessedAt = System.currentTimeMillis();
                        updateOverlay(lastTranslation);
                        bitmap.recycle();
                        processing.set(false);
                    })
                    .addOnFailureListener(error -> {
                        updateOverlay("Traduzione non disponibile offline.\nVerifica la connessione e il modello lingua.");
                        bitmap.recycle();
                        processing.set(false);
                    });
            })
            .addOnFailureListener(error -> {
                bitmap.recycle();
                processing.set(false);
            });
    }

    private void showOverlay(String message) {
        if (windowManager == null || !Settings.canDrawOverlays(this)) return;
        if (overlay == null) {
            TextView text = new TextView(this);
            text.setTextColor(0xFFFFFFFF);
            text.setTextSize(15f);
            text.setPadding(24, 18, 24, 18);
            text.setBackgroundColor(0xE6121B2C);
            text.setMaxLines(8);
            text.setTextIsSelectable(true);
            ScrollView scroll = new ScrollView(this);
            scroll.addView(text);
            int type = Build.VERSION.SDK_INT >= 26
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;
            WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                Math.min(screenWidth > 0 ? screenWidth - 24 : 700, 900),
                WindowManager.LayoutParams.WRAP_CONTENT, type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                    | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                    | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT);
            params.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
            params.y = 60;
            scroll.setBackgroundColor(0xE6121B2C);
            try {
                windowManager.addView(scroll, params);
                overlay = new ViewHolder(scroll, text);
            } catch (Exception ignored) { return; }
        }
        overlay.text.setText(message);
    }

    private void updateOverlay(String translated) {
        if (translated == null || translated.trim().isEmpty()) return;
        worker.post(() -> showOverlay(translated));
    }

    private Notification buildNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_search)
            .setContentTitle("Andros: traduzione dello schermo")
            .setContentText("Acquisizione attiva. Tocca Arresta per terminare.")
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID,
                "Traduzione live Andros", NotificationManager.IMPORTANCE_LOW);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    private void stopSelfSafely() {
        if (stopped) return;
        stopped = true;
        running = false;
        if (imageReader != null) {
            imageReader.setOnImageAvailableListener(null, null);
            imageReader.close();
            imageReader = null;
        }
        if (virtualDisplay != null) {
            virtualDisplay.release();
            virtualDisplay = null;
        }
        if (projection != null) {
            try { projection.stop(); } catch (Exception ignored) {}
            projection = null;
        }
        if (windowManager != null && overlay != null) {
            try { windowManager.removeView(overlay.scroll); } catch (Exception ignored) {}
            overlay = null;
        }
        if (recognizer != null) { recognizer.close(); recognizer = null; }
        if (languageIdentifier != null) { languageIdentifier.close(); languageIdentifier = null; }
        if (translator != null) { translator.close(); translator = null; }
        if (workerThread != null) {
            workerThread.quitSafely();
            workerThread = null;
        }
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    @Override public void onDestroy() { stopSelfSafely(); super.onDestroy(); }
    @Nullable @Override public IBinder onBind(Intent intent) { return null; }
}
