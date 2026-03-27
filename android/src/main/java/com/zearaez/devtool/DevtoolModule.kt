package com.zearaez.devtool

import com.facebook.react.bridge.ReactApplicationContext

class DevtoolModule(reactContext: ReactApplicationContext) :
  NativeDevtoolSpec(reactContext) {

  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }

  override fun setClipboardString(text: String) {
    val clipboard =
      reactApplicationContext.getSystemService(android.content.Context.CLIPBOARD_SERVICE)
        as android.content.ClipboardManager?
    val clip = android.content.ClipData.newPlainText("DevLogger", text)
    clipboard?.setPrimaryClip(clip)
  }

  companion object {
    const val NAME = NativeDevtoolSpec.NAME
  }
}
