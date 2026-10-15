package com.smartpos.pro;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.PrintManager;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();
        webView.addJavascriptInterface(new AndroidNativeInterface(), "AndroidNative");
    }

    public class AndroidNativeInterface {

        @JavascriptInterface
        public boolean isAvailable() {
            return true;
        }

        @JavascriptInterface
        public void printCurrentPage(final String documentName) {
            runOnUiThread(() -> {
                try {
                    PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                    if (printManager == null) {
                        Toast.makeText(MainActivity.this, "خدمة الطباعة غير متوفرة على هذا الجهاز", Toast.LENGTH_SHORT).show();
                        return;
                    }
                    String jobName = (documentName != null && !documentName.trim().isEmpty())
                            ? documentName.trim()
                            : "SmartPOS_Print";

                    WebView webView = getBridge().getWebView();
                    PrintDocumentAdapter printAdapter = webView.createPrintDocumentAdapter(jobName);

                    PrintAttributes.Builder builder = new PrintAttributes.Builder();
                    builder.setColorMode(PrintAttributes.COLOR_MODE_COLOR);
                    builder.setMediaSize(PrintAttributes.MediaSize.ISO_A4);

                    printManager.print(jobName, printAdapter, builder.build());
                } catch (Exception e) {
                    e.printStackTrace();
                    Toast.makeText(MainActivity.this, "خطأ في تشغيل الطباعة: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            });
        }

        @JavascriptInterface
        public void printPdf(final String base64Pdf, final String documentName) {
            runOnUiThread(() -> {
                try {
                    PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                    if (printManager == null) {
                        Toast.makeText(MainActivity.this, "خدمة الطباعة غير متوفرة على هذا الجهاز", Toast.LENGTH_SHORT).show();
                        return;
                    }

                    byte[] pdfBytes = Base64.decode(base64Pdf, Base64.DEFAULT);
                    File cachePath = new File(getCacheDir(), "print_documents");
                    if (!cachePath.exists()) {
                        cachePath.mkdirs();
                    }

                    String safeDocName = (documentName != null && !documentName.trim().isEmpty())
                            ? documentName.replaceAll("[^a-zA-Z0-9._-]", "_")
                            : "Document";
                    if (!safeDocName.endsWith(".pdf")) {
                        safeDocName += ".pdf";
                    }

                    File tempPdfFile = new File(cachePath, safeDocName);
                    try (FileOutputStream stream = new FileOutputStream(tempPdfFile)) {
                        stream.write(pdfBytes);
                        stream.flush();
                    }

                    PrintAttributes.Builder builder = new PrintAttributes.Builder();
                    builder.setColorMode(PrintAttributes.COLOR_MODE_COLOR);
                    builder.setMediaSize(PrintAttributes.MediaSize.ISO_A4);

                    printManager.print(
                            safeDocName,
                            new PdfPrintAdapter(tempPdfFile, safeDocName),
                            builder.build()
                    );
                } catch (Exception e) {
                    e.printStackTrace();
                    Toast.makeText(MainActivity.this, "خطأ أثناء إرسال ملف الطباعة: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            });
        }

        @JavascriptInterface
        public void shareOrSavePdf(final String base64Pdf, final String fileName, final String title) {
            shareOrSaveFile(base64Pdf, fileName, "application/pdf", title);
        }

        @JavascriptInterface
        public void shareOrSaveFile(final String base64Data, final String fileName, final String mimeType, final String title) {
            runOnUiThread(() -> {
                try {
                    byte[] fileBytes = Base64.decode(base64Data, Base64.DEFAULT);

                    File cachePath = new File(getCacheDir(), "shared_documents");
                    if (!cachePath.exists()) {
                        cachePath.mkdirs();
                    }

                    String safeFileName = (fileName != null && !fileName.trim().isEmpty())
                            ? fileName.trim()
                            : "Document.pdf";

                    File sharedFile = new File(cachePath, safeFileName);
                    try (FileOutputStream stream = new FileOutputStream(sharedFile)) {
                        stream.write(fileBytes);
                        stream.flush();
                    }

                    Uri contentUri = FileProvider.getUriForFile(
                            MainActivity.this,
                            getPackageName() + ".fileprovider",
                            sharedFile
                    );

                    if (contentUri != null) {
                        String finalMime = (mimeType != null && !mimeType.trim().isEmpty())
                                ? mimeType.trim()
                                : "application/pdf";

                        Intent shareIntent = new Intent(Intent.ACTION_SEND);
                        shareIntent.setType(finalMime);
                        shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                        shareIntent.putExtra(Intent.EXTRA_SUBJECT, title != null ? title : safeFileName);
                        shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                        Intent chooser = Intent.createChooser(shareIntent, title != null ? title : "مشاركة أو حفظ المستند");
                        chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startActivity(chooser);
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                    Toast.makeText(MainActivity.this, "خطأ أثناء حفظ أو مشاركة المستند: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            });
        }
    }

    private static class PdfPrintAdapter extends PrintDocumentAdapter {
        private final File pdfFile;
        private final String documentName;

        public PdfPrintAdapter(File pdfFile, String documentName) {
            this.pdfFile = pdfFile;
            this.documentName = documentName != null ? documentName : "Document";
        }

        @Override
        public void onLayout(PrintAttributes oldAttributes, PrintAttributes newAttributes,
                             CancellationSignal cancellationSignal, LayoutResultCallback callback, Bundle extras) {
            if (cancellationSignal != null && cancellationSignal.isCanceled()) {
                callback.onLayoutCancelled();
                return;
            }

            PrintDocumentInfo info = new PrintDocumentInfo.Builder(documentName)
                    .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                    .setPageCount(PrintDocumentInfo.PAGE_COUNT_UNKNOWN)
                    .build();

            callback.onLayoutFinished(info, !newAttributes.equals(oldAttributes));
        }

        @Override
        public void onWrite(PageRange[] pages, ParcelFileDescriptor destination,
                            CancellationSignal cancellationSignal, WriteResultCallback callback) {
            InputStream input = null;
            OutputStream output = null;
            try {
                input = new FileInputStream(pdfFile);
                output = new FileOutputStream(destination.getFileDescriptor());

                byte[] buf = new byte[8192];
                int bytesRead;
                while ((bytesRead = input.read(buf)) > 0) {
                    if (cancellationSignal != null && cancellationSignal.isCanceled()) {
                        callback.onWriteCancelled();
                        return;
                    }
                    output.write(buf, 0, bytesRead);
                }
                callback.onWriteFinished(new PageRange[]{PageRange.ALL_PAGES});
            } catch (Exception e) {
                callback.onWriteFailed(e.getMessage());
            } finally {
                try {
                    if (input != null) input.close();
                    if (output != null) output.close();
                } catch (Exception ignored) {}
            }
        }
    }
}
