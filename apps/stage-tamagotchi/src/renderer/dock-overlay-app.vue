<script setup lang="ts">
import { useElectronRelativeMouse } from '@proj-airi/electron-vueuse'
import { Live2DScene } from '@proj-airi/stage-ui-live2d'
import { ThreeScene } from '@proj-airi/stage-ui-three'
import { useSettingsTheme } from '@proj-airi/stage-ui/stores/settings'
import { useSettingsStageModel } from '@proj-airi/stage-ui/stores/settings/stage-model'
import { useTheme } from '@proj-airi/ui'
import { useWindowSize } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, watch } from 'vue'

// Keeps the dark class on documentElement in step with the main window.
useTheme()

const stageModelStore = useSettingsStageModel()
const { stageModelRenderer, stageModelSelected, stageModelSelectedUrl } = storeToRefs(stageModelStore)
// The theme store reads localStorage, so the overlay follows theme changes from the other windows.
const { themeColorsHue, themeColorsHueDynamic } = storeToRefs(useSettingsTheme())

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
  await stageModelStore.initializeStageModel()
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
      :cursor-position="cursorPosition"
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
