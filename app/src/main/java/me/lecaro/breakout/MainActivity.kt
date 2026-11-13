package me.lecaro.breakout

import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import android.view.Window
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.DownloadListener
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.core.content.FileProvider
import java.io.File
import java.net.URLDecoder
import java.nio.charset.StandardCharsets
import java.text.SimpleDateFormat
import java.util.Date

const val CHOOSE_FILE_REQUEST_CODE = 548459

class MainActivity : androidx.activity.ComponentActivity() {

    private lateinit var webView: WebView
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        window.setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN
        );
        webView = WebView(this)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.setSupportZoom(false)


        webView.loadUrl("file:///android_asset/index.html?isInWebView=true")
        val activity = this;

        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean {
                Log.d(
                    "WebView",
                    "${consoleMessage.message()} -- From line " + "${consoleMessage.lineNumber()} of ${consoleMessage.sourceId()}"
                )
                return true
            }


            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                try {

                    fileChooserParams?.createIntent()?.let {
                        startActivityForResult(
                            it, CHOOSE_FILE_REQUEST_CODE
                        )
                    }
                    this@MainActivity.filePathCallback = filePathCallback
                    return true
                } catch (e: Exception) {
                    Log.e("DL", "Error ${e.message}")
                    Toast.makeText(activity, "Error ${e.message}", Toast.LENGTH_LONG).show()
                    return false
                }
            }
        }

        webView.setDownloadListener(DownloadListener { url, userAgent, contentDisposition, mimetype, contentLength ->
            Log.d("DL", "url: ${url}")
            Log.d("DL", "userAgent: ${userAgent}")
            Log.d("DL", "contentDisposition: ${contentDisposition}")
            Log.d("DL", "mimetype: ${mimetype}")
            Log.d("DL", "contentLength: ${contentLength}")

            downloadFile(url)
        })

        setContentView(webView)
        setupBackCallback()
    }

    @Deprecated("This method has been deprecated in favor of using the Activity Result API\n      which brings increased type safety via an {@link ActivityResultContract} and the prebuilt\n      contracts for common intents available in\n      {@link androidx.activity.result.contract.ActivityResultContracts}, provides hooks for\n      testing, and allow receiving results in separate, testable classes independent from your\n      activity. Use\n      {@link #registerForActivityResult(ActivityResultContract, ActivityResultCallback)}\n      with the appropriate {@link ActivityResultContract} and handling the result in the\n      {@link ActivityResultCallback#onActivityResult(Object) callback}.")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {

        super.onActivityResult(requestCode, resultCode, data)
        when (requestCode) {
            CHOOSE_FILE_REQUEST_CODE -> {
                if (resultCode == RESULT_OK) {
                    filePathCallback?.onReceiveValue(
                        WebChromeClient.FileChooserParams.parseResult(
                            resultCode, data
                        )
                    )
                    filePathCallback = null
                }
            }
        }
    }

    var filePathCallback: ValueCallback<Array<Uri>>? = null

    private fun downloadFile(url: String) {
        try {
            val sdf = SimpleDateFormat("yyyy-M-dd-hh-mm")
            val currentDate = sdf.format(Date())

            if (url.startsWith("data:application/json;charset=utf-8,")) {

                val urlEncoded = url.substring("data:application/json;charset=utf-8,".length)
                val str = URLDecoder.decode(urlEncoded, StandardCharsets.UTF_8.name())
                writeFileAndShare(
                    str.toByteArray(),
                    "breakout-71-save-$currentDate.json",
                    "application/json"
                )
            }

            if (url.startsWith("data:video/webm;base64,")) {
                val base64Data = url.substring("data:video/webm;base64,".length)
                val decodedBytes =
                    android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT)
                writeFileAndShare(
                    decodedBytes,
                    "breakout-71-capture-$currentDate.webm",
                    "video/webm"
                )
            }


        } catch (e: Exception) {
            Log.e("DL", "Error ${e.message}")
            Toast.makeText(this, "Error ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    fun writeFileAndShare(bytes: ByteArray, fileName: String, mime: String) {

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // android 10
            val contentValues = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, fileName)
                put(MediaStore.Downloads.MIME_TYPE, mime)
                put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
            }

            val uri: Uri? = contentResolver.insert(
                MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues
            )
            uri?.let {
                contentResolver.openOutputStream(it)?.use { outputStream ->
                    outputStream.write(bytes)
                }
            }

            val shareIntent: Intent = Intent().apply {
                action = Intent.ACTION_SEND
                putExtra(Intent.EXTRA_STREAM, uri)
                type = mime
            }
            startActivity(Intent.createChooser(shareIntent, null))

        } else {

            val file = File(getExternalFilesDir(null), fileName)
            file.writeBytes(bytes)
            val uri = FileProvider.getUriForFile(
                this,
                "$packageName.fileprovider",  // Adjust if your authority is different
                file
            )

            val shareIntent = Intent().apply {
                action = Intent.ACTION_SEND
                putExtra(Intent.EXTRA_STREAM, uri)
                type = mime
                flags = Intent.FLAG_GRANT_READ_URI_PERMISSION
            }

            startActivity(Intent.createChooser(shareIntent, null))

        }
    }

    private fun setupBackCallback() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript("window.backButtonCaptured?.()") { result ->
                    if (!result.toBoolean()) {
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                    }
                }
            }
        })
    }


}