import { fitCamera, pan } from '../iso/camera.ts'
import { createMap } from '../iso/map.ts'
import { presentScene } from '../iso/presentation.ts'
import { NESTED_POSE } from '../layers/orbit.ts'
import type { CoverPayload } from './cover.ts'

const payload = JSON.parse(document.getElementById('cover-data')!.textContent!) as CoverPayload
const host = document.getElementById('map')!
const frame = document.querySelector<HTMLElement>('.architecture-frame')!
const scene = presentScene(payload.sheet, payload.project ?? undefined, NESTED_POSE)
const map = createMap(host, { gridScale: 0.5 })
map.paint(scene)
map.move(pan(fitCamera(scene.bounds, frame.getBoundingClientRect()), frame.offsetLeft, frame.offsetTop), 1)
document.documentElement.dataset.coverReady = 'true'
