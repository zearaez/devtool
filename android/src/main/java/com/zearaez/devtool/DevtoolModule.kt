package com.zearaez.devtool

import com.facebook.react.bridge.ReactApplicationContext

class DevtoolModule(reactContext: ReactApplicationContext) :
  NativeDevtoolSpec(reactContext) {

  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }

  companion object {
    const val NAME = NativeDevtoolSpec.NAME
  }
}
