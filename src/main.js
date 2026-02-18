import './style.css'
import * as THREE from 'three'

const app = document.querySelector('#app')
app.innerHTML = `
  <div id="hud">
    <div><strong>Brainrot Tower</strong> — Climb to Peak Cringe</div>
    <div>Height: <span id="height">0</span>m · Best: <span id="best">0</span>m · Aura: <span id="aura">0</span></div>
    <div class="hint">WASD move · Space jump · Shift dash · R restart</div>
  </div>
  <div id="flash"></div>
`

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0a0a12)
scene.fog = new THREE.Fog(0x0a0a12, 30, 240)

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
app.appendChild(renderer.domElement)

const hemi = new THREE.HemisphereLight(0xaad8ff, 0x220033, 0.6)
scene.add(hemi)
const dir = new THREE.DirectionalLight(0xffffff, 1.2)
dir.position.set(8, 20, 12)
dir.castShadow = true
scene.add(dir)

// Neon-ish tower lane
const towerGroup = new THREE.Group()
scene.add(towerGroup)

const floorCount = 40
const floorSpacing = 6
const platforms = []
const hazards = []
const auraPickups = []

const rng = (seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)(Date.now() % 4294967296)

const matSet = [
  new THREE.MeshStandardMaterial({ color: 0x46d5ff, emissive: 0x113344 }),
  new THREE.MeshStandardMaterial({ color: 0xff58d8, emissive: 0x330a2a }),
  new THREE.MeshStandardMaterial({ color: 0x9dff5a, emissive: 0x1f330a }),
  new THREE.MeshStandardMaterial({ color: 0xffb84d, emissive: 0x33210a })
]

function addPlatform(x, y, z, w = 4, d = 4, moving = false, fake = false) {
  const geom = new THREE.BoxGeometry(w, 0.6, d)
  const mesh = new THREE.Mesh(geom, matSet[Math.floor(rng() * matSet.length)])
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData = { moving, fake, baseX: x, speed: 0.6 + rng() * 1.4, amp: 0.6 + rng() * 1.8 }
  towerGroup.add(mesh)
  platforms.push(mesh)
}

function addAura(x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.35, 0),
    new THREE.MeshStandardMaterial({ color: 0xf8ff7a, emissive: 0x665c11 })
  )
  mesh.position.set(x, y, z)
  mesh.userData.spin = 0.6 + rng()
  towerGroup.add(mesh)
  auraPickups.push(mesh)
}

function addHazard(x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.9, 0.2, 10, 20),
    new THREE.MeshStandardMaterial({ color: 0xff3030, emissive: 0x500c0c })
  )
  mesh.rotation.x = Math.PI / 2
  mesh.position.set(x, y + 0.6, z)
  mesh.userData.spin = 1.5 + rng() * 2
  towerGroup.add(mesh)
  hazards.push(mesh)
}

for (let i = 0; i < floorCount; i++) {
  const y = i * floorSpacing
  const spread = Math.min(6, 1 + i * 0.12)
  const x = (rng() - 0.5) * spread
  const z = (rng() - 0.5) * spread
  const moving = rng() > 0.66
  const fake = rng() > 0.86
  addPlatform(x, y, z, 3.2, 3.2, moving, fake)
  if (rng() > 0.45) addAura(x + (rng() - 0.5) * 1.6, y + 1.2, z + (rng() - 0.5) * 1.6)
  if (i > 3 && rng() > 0.7) addHazard(x + (rng() - 0.5) * 1.2, y, z + (rng() - 0.5) * 1.2)
}

// Ground
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(20, 48),
  new THREE.MeshStandardMaterial({ color: 0x111122, emissive: 0x05050d })
)
ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true
scene.add(ground)

// Player
const player = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.35, 1.0, 4, 8),
  new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x222222 })
)
player.position.set(0, 1.2, 0)
player.castShadow = true
scene.add(player)

camera.position.set(0, 3.2, 8)

const keys = {}
window.addEventListener('keydown', (e) => {
  keys[e.code] = true
  if (e.code === 'KeyR') reset()
})
window.addEventListener('keyup', (e) => (keys[e.code] = false))

const state = {
  vx: 0,
  vz: 0,
  vy: 0,
  onGround: false,
  aura: 0,
  best: Number(localStorage.getItem('brainrot_best') || 0),
  gravity: 18,
  speedMult: 1,
  reverse: false,
  ice: false,
  eventTimer: 0,
  eventName: ''
}

const ui = {
  h: document.querySelector('#height'),
  b: document.querySelector('#best'),
  a: document.querySelector('#aura'),
  flash: document.querySelector('#flash')
}
ui.b.textContent = state.best.toFixed(1)

function showEvent(name) {
  state.eventName = name
  ui.flash.textContent = name
  ui.flash.classList.add('on')
  setTimeout(() => ui.flash.classList.remove('on'), 900)
}

function randomEvent() {
  const roll = Math.floor(rng() * 4)
  state.eventTimer = 4.5
  state.reverse = false
  state.ice = false
  state.speedMult = 1
  state.gravity = 18
  if (roll === 0) {
    state.gravity = 8
    showEvent('LOW GRAVITY')
  } else if (roll === 1) {
    state.reverse = true
    showEvent('REVERSE CONTROLS')
  } else if (roll === 2) {
    state.ice = true
    showEvent('ICE FLOOR')
  } else {
    state.speedMult = 1.6
    showEvent('ZOOMIES')
  }
}

function reset() {
  player.position.set(0, 1.2, 0)
  state.vx = state.vy = state.vz = 0
  state.aura = 0
  state.eventTimer = 0
  state.reverse = state.ice = false
  state.gravity = 18
}

function intersectsTop(p, px, py, pz) {
  const halfW = 1.6
  const halfD = 1.6
  const withinX = px > p.position.x - halfW && px < p.position.x + halfW
  const withinZ = pz > p.position.z - halfD && pz < p.position.z + halfD
  const topY = p.position.y + 0.3
  return { hit: withinX && withinZ && py <= topY + 0.2 && py >= topY - 1.5, topY }
}

let last = performance.now()
function animate(now) {
  const dt = Math.min(0.033, (now - last) / 1000)
  last = now

  if (state.eventTimer > 0) {
    state.eventTimer -= dt
    if (state.eventTimer <= 0) {
      state.reverse = false
      state.ice = false
      state.speedMult = 1
      state.gravity = 18
    }
  } else if (rng() > 0.995) {
    randomEvent()
  }

  // moving platforms
  for (const p of platforms) {
    if (p.userData.moving) {
      p.position.x = p.userData.baseX + Math.sin(now * 0.001 * p.userData.speed) * p.userData.amp
    }
    if (p.userData.fake) {
      p.material.opacity = 0.55 + Math.sin(now * 0.004 + p.position.y) * 0.25
      p.material.transparent = true
    }
  }

  // Input
  const dirX = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0)
  const dirZ = (keys['KeyS'] ? 1 : 0) - (keys['KeyW'] ? 1 : 0)
  const rev = state.reverse ? -1 : 1
  const accel = 18 * state.speedMult
  const friction = state.ice ? 0.98 : 0.84

  state.vx += dirX * accel * dt * rev
  state.vz += dirZ * accel * dt * rev
  state.vx *= friction
  state.vz *= friction

  if (keys['ShiftLeft'] || keys['ShiftRight']) {
    state.vx *= 1.02
    state.vz *= 1.02
  }

  if (keys['Space'] && state.onGround) {
    state.vy = 8.6
    state.onGround = false
  }

  state.vy -= state.gravity * dt

  player.position.x += state.vx * dt
  player.position.z += state.vz * dt
  player.position.y += state.vy * dt

  // collisions with platforms
  state.onGround = false
  for (const p of platforms) {
    const c = intersectsTop(p, player.position.x, player.position.y, player.position.z)
    if (c.hit && state.vy <= 0) {
      if (p.userData.fake && rng() > 0.7) {
        // phase through occasionally
      } else {
        player.position.y = c.topY + 0.85
        state.vy = 0
        state.onGround = true
      }
    }
  }

  // hazards knockback
  for (const h of hazards) {
    h.rotation.z += dt * h.userData.spin
    const d = h.position.distanceTo(player.position)
    if (d < 1.15) {
      const kx = (player.position.x - h.position.x) || (rng() - 0.5)
      const kz = (player.position.z - h.position.z) || (rng() - 0.5)
      const mag = Math.hypot(kx, kz) || 1
      state.vx += (kx / mag) * 8
      state.vz += (kz / mag) * 8
      state.vy = Math.max(state.vy, 5)
      showEvent('CRINGE KNOCKBACK')
    }
  }

  // aura pickups
  for (let i = auraPickups.length - 1; i >= 0; i--) {
    const a = auraPickups[i]
    a.rotation.y += dt * a.userData.spin
    if (a.position.distanceTo(player.position) < 0.9) {
      towerGroup.remove(a)
      auraPickups.splice(i, 1)
      state.aura += 1
    }
  }

  // fail state
  if (player.position.y < -8) {
    const peak = Math.max(0, player.position.y + 8)
    state.best = Math.max(state.best, Math.max(peak, Number(ui.h.textContent || 0)))
    localStorage.setItem('brainrot_best', String(state.best))
    ui.b.textContent = state.best.toFixed(1)
    showEvent('YOU FELL. PRESS R')
    reset()
  }

  // camera follow
  camera.position.x += (player.position.x - camera.position.x) * 0.08
  camera.position.y += (player.position.y + 2.8 - camera.position.y) * 0.08
  camera.position.z += (player.position.z + 7.4 - camera.position.z) * 0.08
  camera.lookAt(player.position.x, player.position.y + 0.7, player.position.z)

  const height = Math.max(0, player.position.y - 1.2)
  if (height > state.best) {
    state.best = height
    localStorage.setItem('brainrot_best', String(state.best))
  }

  ui.h.textContent = height.toFixed(1)
  ui.b.textContent = state.best.toFixed(1)
  ui.a.textContent = String(state.aura)

  renderer.render(scene, camera)
  requestAnimationFrame(animate)
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

requestAnimationFrame(animate)
