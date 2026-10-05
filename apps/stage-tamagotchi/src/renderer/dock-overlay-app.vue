<script setup lang="ts">
import { useElectronEventaContext, useElectronRelativeMouse } from '@proj-airi/electron-vueuse'
import { Live2DScene } from '@proj-airi/stage-ui-live2d'
import { ThreeScene } from '@proj-airi/stage-ui-three'
import { useSettings } from '@proj-airi/stage-ui/stores/settings'
import { useTheme } from '@proj-airi/ui'
import { useWindowSize } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'

import { dockOverlayThemeUpdated } from '../shared/eventa'

const settingsStore = useSettings()
// Keeps the dark class on documentElement in step with the main window.
useTheme()
const eventaContext = useElectronEventaContext()

const {
  stageModelRenderer,
  stageModelSelected,
  stageModelSelectedUrl,
  themeColorsHue,
  themeColorsHueDynamic,
} = storeToRefs(settingsStore)

watch(themeColorsHue, () => {
  document.documentElement.style.setProperty('--chromatic-hue', themeColorsHue.value.toString())
}, { immediate: true })

watch(themeColorsHueDynamic, () => {
  document.documentElement.classList.toggle('dynamic-hue', themeColorsHueDynamic.value)
}, { immediate: true })

const { width, height } = useWindowSize()
const mouse = useElectronRelativeMouse({ initialValue: { x: width.value / 2, y: height.value / 2 } })

const cursorPosition = computed(() => ({
  x: mouse.x.value,
  y: mouse.y.value,
}))

onMounted(async () => {
  await settingsStore.initializeStageModel()

  let disposeThemeListener: (() => void) | undefined
  try {
    disposeThemeListener = eventaContext.value.on(dockOverlayThemeUpdated, (event) => {
      const payload = event?.body
      if (!payload)
        return

      themeColorsHue.value = payload.hue
      themeColorsHueDynamic.value = payload.dynamic
    })
  }
  catch (err) {
    console.error('Failed to bind dock overlay theme sync', err)
  }

  onBeforeUnmount(() => {
    disposeThemeListener?.()
  })
})
</script>

<template>
  <div :class="['h-full', 'w-full', 'overflow-hidden']">
    <Live2DScene
      v-if="stageModelRenderer === 'live2d'"
      :cursor-position="cursorPosition"
      :model-src="stageModelSelectedUrl"
      :model-id="stageModelSelected"
      :theme-colors-hue="themeColorsHue"
      :theme-colors-hue-dynamic="themeColorsHueDynamic"
    />
    <ThreeScene
      v-else-if="stageModelRenderer === 'vrm'"
      :model-id="stageModelSelected"
      :model-src="stageModelSelectedUrl"
    />
  </div>
</template>

<style>
html,
body,
#app {
  background: transparent;
  overflow: hidden;
}
</style>
