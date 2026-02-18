import './style.css'
import * as THREE from 'three'

const app = document.querySelector('#app')
app.innerHTML = `
  <div id="ui">
    <div id="title">BRAINROT TOWER // ARCADE PARKOUR</div>
    <div id="stats">Time <span id="time">0.00</span>s · Height <span id="height">0.0</span>m · Best <span id="best">0.0</span>m</div>
    <div id="help">WASD move · SPACE jump · SHIFT sprint · R restart</div>
  </div>
  <div id="overlay" class="show">
    <div class="card">
      <h1>ARCADE PARKOUR</h1>
      <p>Reach the finish pad as fast as possible.</p>
      <button id="startBtn">Start Run</button>
    </div>
  </div>
`

const timeEl = document.getElementById('time')
const heightEl = document.getElementById('height')
const bestEl = document.getElementById('best')
const overlay = document.getElementById('overlay')
const startBtn = document.getElementById('startBtn')

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0a0e18)
scene.fog = new THREE.Fog(0x0a0e18, 25, 220)

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 1000)
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(2, devicePixelRatio))
renderer.setSize(innerWidth, innerHeight)
renderer.shadowMap.enabled = true
app.appendChild(renderer.domElement)

// lighting
const hemi = new THREE.HemisphereLight(0x9ecbff, 0x130b22, 0.55)
scene.add(hemi)
const sun = new THREE.DirectionalLight(0xffffff, 1.3)
sun.position.set(8, 24, 10)
sun.castShadow = true
scene.add(sun)

// world
const world = new THREE.Group()
scene.add(world)

const MAT_PLATFORM = new THREE.MeshStandardMaterial({ color: 0x3cd4ff, emissive: 0x06283b, roughness: 0.35 })
const MAT_MOVING = new THREE.MeshStandardMaterial({ color: 0xff5ecf, emissive: 0x300b25, roughness: 0.35 })
const MAT_GOAL = new THREE.MeshStandardMaterial({ color: 0x9aff5e, emissive: 0x1f3d0b, roughness: 0.4 })

const platforms = []
let goalPad = null

function makePlatform(x, y, z, w, d, moving = false, axis = 'x', amp = 0, speed = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, d), moving ? MAT_MOVING : MAT_PLATFORM)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData = { moving, axis, amp, speed, baseX: x, baseZ: z, w, d }
  world.add(mesh)
  platforms.push(mesh)
}

function buildCourse() {
  // start platform
  makePlatform(0, 0, 0, 10, 10)

  // handcrafted readable sections
  const steps = [
    [0, 4, 0, 6, 6, false],
    [2.5, 8, -1.5, 4.6, 4.6, false],
    [-2.7, 12, -0.5, 4.2, 4.2, false],
    [0.2, 16, 2.3, 4.2, 4.2, true, 'x', 1.4, 1.1],
    [3.6, 20, -1.8, 4.0, 4.0, false],
    [-3.8, 24, 1.4, 4.0, 4.0, true, 'z', 1.5, 1.0],
    [0.4, 28, -3.2, 3.8, 3.8, false],
    [2.8, 32, 1.8, 3.8, 3.8, false],
    [-2.6, 36, -0.8, 3.6, 3.6, true, 'x', 1.8, 1.2],
    [0, 41, 0, 8, 8, false]
  ]

  for (const s of steps) makePlatform(...s)

  goalPad = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.5, 24), MAT_GOAL)
  goalPad.position.set(0, 42, 0)
  goalPad.receiveShadow = true
  world.add(goalPad)

  // visual rails
  const railMat = new THREE.MeshStandardMaterial({ color: 0x243350, emissive: 0x0b1322 })
  for (let i = 0; i < 4; i++) {
    const angle = (Math.PI / 2) * i + Math.PI / 4
    const x = Math.cos(angle) * 8
    const z = Math.sin(angle) * 8
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 52, 0.4), railMat)
    rail.position.set(x, 21, z)
    rail.castShadow = true
    world.add(rail)
  }

  const floor = new THREE.Mesh(new THREE.CircleGeometry(22, 48), new THREE.MeshStandardMaterial({ color: 0x0b1326, emissive: 0x040912 }))
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  world.add(floor)
}

buildCourse()

// player capsule
const player = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.35, 1.0, 4, 8),
  new THREE.MeshStandardMaterial({ color: 0xf7fbff, emissive: 0x1a1d23 })
)
player.castShadow = true
scene.add(player)

const spawn = new THREE.Vector3(0, 1.3, 0)
player.position.copy(spawn)

camera.position.set(0, 3.5, 8)

// state
const state = {
  started: false,
  finished: false,
  t: 0,
  best: Number(localStorage.getItem('bt_best_time') || 0),
  vx: 0,
  vz: 0,
  vy: 0,
  onGround: false,
}
if (state.best > 0) bestEl.textContent = state.best.toFixed(2)

const keys = {}
window.addEventListener('keydown', (e) => {
  keys[e.code] = true
  if (e.code === 'KeyR') resetRun(true)
})
window.addEventListener('keyup', (e) => (keys[e.code] = false))

function startRun() {
  state.started = true
  state.finished = false
  state.t = 0
  overlay.classList.remove('show')
}

startBtn.onclick = () => {
  resetRun(false)
  startRun()
}

function resetRun(showMenu = false) {
  player.position.copy(spawn)
  state.vx = state.vy = state.vz = 0
  state.onGround = false
  state.finished = false
  state.t = 0
  timeEl.textContent = '0.00'
  if (showMenu) {
    overlay.innerHTML = `<div class="card"><h1>Reset</h1><p>Start another run.</p><button id="startBtn">Start Run</button></div>`
    overlay.classList.add('show')
    document.getElementById('startBtn').onclick = () => { resetRun(false); startRun() }
    state.started = false
  }
}

function finishRun() {
  state.finished = true
  state.started = false
  const time = state.t
  if (state.best === 0 || time < state.best) {
    state.best = time
    localStorage.setItem('bt_best_time', String(time))
    bestEl.textContent = time.toFixed(2)
  }
  overlay.innerHTML = `<div class="card"><h1>Finished</h1><p>Time: <strong>${time.toFixed(2)}s</strong></p><p>Best: <strong>${(state.best || time).toFixed(2)}s</strong></p><button id="startBtn">Run Again</button></div>`
  overlay.classList.add('show')
  document.getElementById('startBtn').onclick = () => { resetRun(false); startRun() }
}

function topCollision(p) {
  const halfW = p.userData.w / 2
  const halfD = p.userData.d / 2
  const px = player.position.x
  const pz = player.position.z
  const within = px >= p.position.x - halfW && px <= p.position.x + halfW && pz >= p.position.z - halfD && pz <= p.position.z + halfD
  const top = p.position.y + 0.35
  return { within, top }
}

let last = performance.now()
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000)
  last = now

  // animate moving platforms
  for (const p of platforms) {
    if (p.userData.moving) {
      const val = Math.sin(now * 0.001 * p.userData.speed) * p.userData.amp
      if (p.userData.axis === 'x') p.position.x = p.userData.baseX + val
      else p.position.z = p.userData.baseZ + val
    }
  }

  if (state.started && !state.finished) {
    state.t += dt
    timeEl.textContent = state.t.toFixed(2)

    const speed = (keys.ShiftLeft || keys.ShiftRight) ? 11.5 : 8.0
    const accel = 52
    const dragGround = 12
    const dragAir = 2.5

    const ix = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0)
    const iz = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0)

    const len = Math.hypot(ix, iz) || 1
    const dx = ix / len
    const dz = iz / len

    state.vx += dx * accel * dt
    state.vz += dz * accel * dt

    const horiz = Math.hypot(state.vx, state.vz)
    if (horiz > speed) {
      state.vx = (state.vx / horiz) * speed
      state.vz = (state.vz / horiz) * speed
    }

    const drag = state.onGround ? dragGround : dragAir
    state.vx -= state.vx * Math.min(1, drag * dt)
    state.vz -= state.vz * Math.min(1, drag * dt)

    if (keys.Space && state.onGround) {
      state.vy = 8.8
      state.onGround = false
    }

    state.vy -= 24 * dt

    player.position.x += state.vx * dt
    player.position.z += state.vz * dt
    player.position.y += state.vy * dt

    // platform collisions
    state.onGround = false
    for (const p of platforms) {
      const c = topCollision(p)
      if (c.within && state.vy <= 0 && player.position.y >= c.top - 1.4 && player.position.y <= c.top + 0.4) {
        player.position.y = c.top + 0.85
        state.vy = 0
        state.onGround = true
      }
    }

    // fail
    if (player.position.y < -6) {
      resetRun(true)
    }

    // finish check
    if (goalPad && player.position.distanceTo(goalPad.position) < 2.35 && player.position.y > 41.8) {
      finishRun()
    }
  }

  const h = Math.max(0, player.position.y - 1.3)
  heightEl.textContent = h.toFixed(1)

  // camera follow (smoother)
  const camTarget = new THREE.Vector3(player.position.x, player.position.y + 1.7, player.position.z)
  const camPos = new THREE.Vector3(player.position.x, player.position.y + 3.0, player.position.z + 7.2)
  camera.position.lerp(camPos, 0.12)
  camera.lookAt(camTarget)

  renderer.render(scene, camera)
  requestAnimationFrame(loop)
}

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
})

requestAnimationFrame(loop)
