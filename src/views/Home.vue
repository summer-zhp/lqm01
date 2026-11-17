<template>
  <div class="relative h-screen w-screen">
    <!-- 左上控制面板 -->
    <div class="control-panel-left absolute top-4 left-4 z-[1000] flex flex-col gap-3">
      <!-- 功能区 1: 避难所浏览与路线查询 -->
      <!-- <div class="bg-white rounded shadow p-3 flex flex-col gap-2">
        <h3 class="text-xs font-bold text-gray-700">避難所検索</h3>
        <div class="button-group flex gap-2">
          <button
            @click="showAllShelters"
            class="bg-green-600 text-white text-xs px-3 py-1 rounded shadow hover:bg-green-700">
            全部表示
          </button>
          <select v-model="selectedType" class="border px-2 py-1 text-sm rounded w-32">
            <option value="">種別で絞り込み</option>
            <option v-for="type in shelterTypes" :key="type" :value="type">
              {{ type }}
            </option>
          </select>
          <button
            @click="filterSheltersByType"
            class="bg-gray-600 text-white text-xs px-3 py-1 rounded shadow hover:bg-gray-700"
            :disabled="!selectedType">
            検索
          </button>
        </div>
        <p class="text-[10px] text-gray-500">※地図上のピンをタップしてルート検索</p>
      </div> -->

      <!-- 功能区 2: 灾害智能推荐 -->
      <div class="bg-white rounded shadow p-3 flex flex-col gap-2">
        <h3 class="text-xs font-bold text-red-600">緊急時推奨 (災害別)</h3>
        <div class="button-group flex gap-2">
          <select v-model="selectedDisasterType" class="border px-2 py-1 text-sm rounded w-32">
            <option disabled value="">災害種別選択</option>
            <option v-for="dtype in disasterTypes" :key="dtype" :value="dtype">
              {{ dtype }}
            </option>
          </select>
          <button
            @click="recommendShelter"
            class="bg-red-500 text-white text-xs px-3 py-1 rounded shadow hover:bg-red-600"
            :disabled="!selectedDisasterType || isLoading">
            推奨避難所
          </button>
        </div>
        <span v-if="isLoading" class="text-xs text-gray-600">計算中...</span>
      </div>

      <!-- 功能区 3: 移动手段选择 -->
      <div class="bg-white rounded shadow p-3 flex flex-col gap-2">
        <h3 class="text-xs font-bold text-blue-600">移動手段</h3>
        <select v-model="selectedTransportMode" class="border px-2 py-1 text-sm rounded w-full">
          <option v-for="mode in transportModes" :key="mode.value" :value="mode.value">
            {{ mode.label }}
          </option>
        </select>
      </div>
    </div>

    <!-- 推荐信息展示面板 -->
    <div class="status-panel-right absolute top-4 right-4 z-[1000] bg-white rounded shadow p-3 w-64 text-xs space-y-2">
      <h3 class="font-bold">ステータス</h3>
      <p class="text-gray-600"><strong>モード:</strong> {{ currentFilterMode }}</p>
      <div v-if="targetShelterInfo">
        <p class="font-bold text-blue-600 mb-1">【選択中の避難所】</p>
        <p><strong>名稱:</strong> {{ targetShelterInfo.P20_002 }}</p>
        <p><strong>住所:</strong> {{ targetShelterInfo.P20_003 }}</p>
        <p><strong>距離:</strong> 約{{ Math.round(targetShelterInfo.distance) }}m</p>
        <p v-if="targetShelterInfo.duration">
          <strong>所要時間 ({{ getTransportLabel(selectedTransportMode) }}):</strong> 約{{
            Math.round(targetShelterInfo.duration / 60)
          }}分
        </p>
        <p v-else class="text-gray-500">(ルート未計算)</p>

        <!-- 面板内的获取路线按钮 -->
        <button
          @click="getRouteToShelter(targetShelterInfo)"
          class="mt-2 w-full bg-blue-600 text-white text-xs px-2 py-1 rounded shadow hover:bg-blue-700">
          ここへ行く (ルート検索)
        </button>

        <!-- AR 导航按钮 -->
        <!-- <button
          @click="startAR"
          class="ar-button mt-2 w-full bg-purple-600 text-white text-xs px-2 py-1 rounded shadow hover:bg-purple-700"
        >
          ARナビ (実景ガイド)
        </button> -->
      </div>
      <div v-else>
        <p>避難所を選択、または推奨機能を使用してください。</p>
      </div>
      <hr />
      <p><strong>表示件数:</strong> {{ filteredShelters.length }} 箇所</p>
    </div>

    <!-- AR Overlay -->
    <div v-if="isARMode" class="fixed inset-0 z-[2000] bg-black">
      <video ref="arVideo" autoplay playsinline class="w-full h-full object-cover"></video>

      <!-- AR UI Overlay -->
      <div class="ar-overlay absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
        <!-- Direction Arrow -->
        <div
          class="ar-arrow w-32 h-32 border-4 border-white rounded-full flex items-center justify-center mb-4 transition-transform duration-100 ease-linear"
          :style="{ transform: `rotate(${arrowRotation}deg)` }">
          <div
            class="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-b-[40px] border-b-red-500"></div>
        </div>

        <!-- Info Box -->
        <div class="ar-info bg-black/50 text-white p-4 rounded text-center backdrop-blur-sm">
          <p class="text-lg font-bold">{{ targetShelterInfo?.P20_002 }}</p>
          <p class="text-2xl font-bold my-2">{{ Math.round(targetShelterInfo?.distance || 0) }}m</p>
          <p class="text-sm">矢印の方向へ進んでください</p>
        </div>
      </div>

      <!-- Close Button -->
      <button
        @click="stopAR"
        class="ar-close-btn absolute top-4 right-4 bg-white text-black px-4 py-2 rounded-full font-bold shadow-lg z-[2001]">
        ✕ 閉じる
      </button>
    </div>

    <div ref="mapContainer" class="h-full w-full"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, onUnmounted } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

const ORS_API_KEY =
  'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjZlYjdlY2I3YjlhMjQ5MDY5YzIzYjc4NDVjY2NlYzFhIiwiaCI6Im11cm11cjY0In0='

// 修复 Leaflet 图标不显示问题
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

const mapContainer = ref(null)
let map
let markerCluster
let currentLocationMarker
let routeLine
let radiusCircle

const userLocation = ref(null)
const searchRadiusMeters = 500

const shelters = ref([])
const shelterTypes = ref([])
const selectedType = ref('')

const disasterTypes = ['地震', '海啸', '水灾', '火山', 'その他', '未指定']
const selectedDisasterType = ref('')

const transportModes = [
  { label: '徒歩 (Walking)', value: 'foot-walking' },
  { label: '車 (Driving)', value: 'driving-car' },
  { label: '自転車 (Cycling)', value: 'cycling-regular' },
]
const selectedTransportMode = ref('foot-walking')

const isLoading = ref(false)
const targetShelterInfo = ref(null)
const filteredShelters = ref([])
const currentFilterMode = ref('周辺 (500m)')

// AR Related Refs
const isARMode = ref(false)
const arVideo = ref(null)
const deviceAlpha = ref(0)
const targetBearing = ref(0)

const arrowRotation = computed(() => {
  let rotation = targetBearing.value - deviceAlpha.value
  while (rotation < -180) rotation += 360
  while (rotation > 180) rotation -= 360
  return rotation
})

function getTransportLabel(value) {
  const mode = transportModes.find((m) => m.value === value)
  return mode ? mode.label.split(' ')[0] : ''
}

onMounted(async () => {
  map = L.map(mapContainer.value, {
    center: [34.39302642506987, 135.34007690909195],
    zoom: 15,
  })

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors',
  }).addTo(map)

  try {
    const response = await fetch('/P20-12_27 .json')
    const geojson = await response.json()

    // Parse GeoJSON FeatureCollection
    const facilities = []
    
    if (geojson.type === 'FeatureCollection' && geojson.features) {
      for (const feature of geojson.features) {
        if (feature.geometry && feature.geometry.type === 'Point' && feature.properties) {
          const obj = {}
          
          // GeoJSON coordinates are [longitude, latitude], need to reverse for Leaflet [latitude, longitude]
          const coords = feature.geometry.coordinates
          obj.coordinates = [coords[1], coords[0]]
          
          // Copy all properties
          obj.P20_001 = feature.properties.P20_001 || ''
          obj.P20_002 = feature.properties.P20_002 || ''
          obj.P20_003 = feature.properties.P20_003 || ''
          obj.P20_004 = feature.properties.P20_004 || ''
          obj.P20_005 = feature.properties.P20_005 || 0
          obj.P20_006 = feature.properties.P20_006 || -1
          obj.P20_007 = feature.properties.P20_007 || 0
          obj.P20_008 = feature.properties.P20_008 || 0
          obj.P20_009 = feature.properties.P20_009 || 0
          obj.P20_010 = feature.properties.P20_010 || 0
          obj.P20_011 = feature.properties.P20_011 || 0
          obj.P20_012 = feature.properties.P20_012 || 0
          
          facilities.push(obj)
        }
      }
    }
    
    console.log('Parsed Facilities from JSON:', facilities)

    shelters.value = facilities
    shelterTypes.value = [...new Set(shelters.value.map((s) => s.P20_004))]
  } catch (err) {
    console.error('JSON Parse Error:', err)
    alert('データの読み込みに失敗しました')
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords
      userLocation.value = { lat: latitude, lng: longitude }
      updateUserMarker(latitude, longitude)
      updateMarkersByRadius()
      map.setView([latitude, longitude], 15)
    },
    (err) => {
      console.error(err)
      renderMarkers()
      currentFilterMode.value = '全件表示 (位置情報なし)'
    }
  )
})

function updateUserMarker(lat, lng) {
  if (currentLocationMarker) map.removeLayer(currentLocationMarker)
  currentLocationMarker = L.marker([lat, lng], {
    icon: L.divIcon({
      html: '<div style="background-color: #3B82F6; width: 16px; height: 16px; border-radius: 50%; border: 2px solid #1D4ED8;"></div>',
    }),
  })
    .addTo(map)
    .bindPopup('現在位置')

  if (radiusCircle) map.removeLayer(radiusCircle)
  radiusCircle = L.circle([lat, lng], {
    radius: searchRadiusMeters,
    color: '#3B82F6',
    fillColor: '#BFDBFE',
    fillOpacity: 0.3,
  }).addTo(map)
}

function renderMarkers(list = shelters.value) {
  if (markerCluster) map.removeLayer(markerCluster)
  markerCluster = L.markerClusterGroup()

  list.forEach((shelter) => {
    const marker = L.marker(shelter.coordinates, {
      icon: L.divIcon({
        html: '<div style="background-color: #F44336; width: 16px; height: 16px; border-radius: 50%; border: 2px solid #333;"></div>',
      }),
    })

    const popupContent = document.createElement('div')
    popupContent.style.minWidth = '200px'
    popupContent.innerHTML = `
      <h3 style="margin: 0 0 10px 0; font-weight: bold;">${shelter.P20_002}</h3>
      <p style="margin: 4px 0;"><strong>住所:</strong> ${shelter.P20_003}</p>
      <p style="margin: 4px 0;"><strong>種別:</strong> ${shelter.P20_004}</p>
      <p style="margin: 4px 0;"><strong>収容人数:</strong> ${shelter.P20_005}</p>
    `

    const routeBtn = document.createElement('button')
    routeBtn.innerText = 'ここへ行く (ルート検索)'
    routeBtn.style.marginTop = '8px'
    routeBtn.style.padding = '6px 12px'
    routeBtn.style.backgroundColor = '#3B82F6'
    routeBtn.style.color = 'white'
    routeBtn.style.border = 'none'
    routeBtn.style.borderRadius = '4px'
    routeBtn.style.cursor = 'pointer'
    routeBtn.style.width = '100%'

    routeBtn.onclick = () => {
      getRouteToShelter(shelter)
      marker.closePopup()
    }

    popupContent.appendChild(routeBtn)
    marker.bindPopup(popupContent)

    marker.on('click', () => {
      let dist = 0
      if (userLocation.value) {
        dist = calculateDistance(
          userLocation.value.lat,
          userLocation.value.lng,
          shelter.coordinates[0],
          shelter.coordinates[1]
        )
      }
      targetShelterInfo.value = {
        ...shelter,
        distance: dist,
        duration: shelter.duration || null,
      }
    })

    markerCluster.addLayer(marker)
  })

  map.addLayer(markerCluster)
}

function updateMarkersByRadius() {
  if (!userLocation.value) {
    renderMarkers()
    currentFilterMode.value = '全件表示'
    return
  }
  const { lat, lng } = userLocation.value
  const sheltersInRadius = shelters.value.filter((shelter) => {
    const distance = calculateDistance(lat, lng, shelter.coordinates[0], shelter.coordinates[1])
    shelter.distanceFromUser = distance
    return distance <= searchRadiusMeters
  })
  filteredShelters.value = sheltersInRadius
  currentFilterMode.value = '周辺 (500m)'
  renderMarkers(sheltersInRadius)
}

function showAllShelters() {
  selectedType.value = ''
  selectedDisasterType.value = ''
  filteredShelters.value = shelters.value
  currentFilterMode.value = '全件表示'
  renderMarkers(shelters.value)
  targetShelterInfo.value = null
  if (routeLine) map.removeLayer(routeLine)

  if (markerCluster) {
    map.fitBounds(markerCluster.getBounds(), { padding: [50, 50] })
  }
}

function filterSheltersByType() {
  if (!selectedType.value) return

  const result = shelters.value.filter((s) => s.P20_004 === selectedType.value)
  filteredShelters.value = result
  currentFilterMode.value = `種別: ${selectedType.value}`
  renderMarkers(result)

  if (result.length === 0) {
    alert('該当する避難所がありません')
  } else {
    if (markerCluster) {
      map.fitBounds(markerCluster.getBounds(), { padding: [50, 50] })
    }
  }
}

async function getRouteToShelter(shelter) {
  if (isLoading.value) return
  isLoading.value = true

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude, longitude } = pos.coords
    userLocation.value = { lat: latitude, lng: longitude }
    updateUserMarker(latitude, longitude)

    try {
      const distance = calculateDistance(latitude, longitude, shelter.coordinates[0], shelter.coordinates[1])
      const limit = selectedTransportMode.value === 'foot-walking' ? 50000 : 200000

      if (distance > limit) {
        alert('距離が遠すぎるため、ルートを検索できません。')
        targetShelterInfo.value = {
          ...shelter,
          distance: distance,
          duration: null,
        }
        isLoading.value = false
        return
      }

      const routeData = await fetchRoute([latitude, longitude], shelter.coordinates)

      if (routeLine) map.removeLayer(routeLine)
      routeLine = L.geoJSON(routeData, {
        style: { color: 'red', weight: 5, opacity: 0.7 },
      }).addTo(map)

      const summary = routeData.features[0].properties.summary
      map.fitBounds(L.geoJSON(routeData).getBounds(), { padding: [50, 50] })

      targetShelterInfo.value = {
        ...shelter,
        distance: distance,
        duration: summary.duration,
      }
    } catch (e) {
      console.error(e)
      alert('ルート取得に失敗しました')
    } finally {
      isLoading.value = false
    }
  })
}

async function recommendShelter() {
  if (isLoading.value) return
  if (!selectedDisasterType.value) return

  isLoading.value = true
  targetShelterInfo.value = null
  currentFilterMode.value = `推奨: ${selectedDisasterType.value}`

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude, longitude } = pos.coords
    userLocation.value = { lat: latitude, lng: longitude }
    updateUserMarker(latitude, longitude)

    const isSafe = (s) => {
      if (selectedDisasterType.value === '地震') return s.P20_007 === 1
      if (selectedDisasterType.value === '海啸') return s.P20_008 === 1
      if (selectedDisasterType.value === '水灾') return s.P20_009 === 1
      if (selectedDisasterType.value === '火山') return s.P20_010 === 1
      if (selectedDisasterType.value === 'その他') return s.P20_011 === 1
      if (selectedDisasterType.value === '未指定') return s.P20_012 === 1
      return true
    }

    // 直接显示所有符合灾害类型的避难所，不限制范围
    let candidates = shelters.value.filter((s) => {
      const d = calculateDistance(latitude, longitude, s.coordinates[0], s.coordinates[1])
      s.distanceFromUser = d
      return isSafe(s)
    })
    
    // 按距离排序，最近的在前面
    candidates.sort((a, b) => a.distanceFromUser - b.distanceFromUser)

    if (candidates.length === 0) {
      alert('安全な避難所が見つかりませんでした')
      isLoading.value = false
      return
    }

    filteredShelters.value = candidates
    renderMarkers(candidates)

    let bestShelter = null
    let minScore = Infinity

    for (const shelter of candidates) {
      const score = shelter.distanceFromUser
      if (score < minScore) {
        minScore = score
        bestShelter = shelter
      }
    }

    if (bestShelter) {
      await getRouteToShelter(bestShelter)
    }

    isLoading.value = false
  })
}

async function fetchRoute(start, end) {
  const profile = selectedTransportMode.value
  const url = `https://api.openrouteservice.org/v2/directions/${profile}/geojson`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: ORS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      coordinates: [
        [start[1], start[0]],
        [end[1], end[0]],
      ],
    }),
  })
  if (!response.ok) throw new Error('ルート取得失敗')
  return await response.json()
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

async function startAR() {
  if (!targetShelterInfo.value || !userLocation.value) {
    alert('先に避難所を選択してください')
    return
  }

  targetBearing.value = calculateBearing(
    userLocation.value.lat,
    userLocation.value.lng,
    targetShelterInfo.value.coordinates[0],
    targetShelterInfo.value.coordinates[1]
  )

  try {
    let stream
    try {
      // 优先尝试后置摄像头（移动设备）
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
    } catch (e) {
      // 如果后置摄像头不可用，尝试前置摄像头或任意摄像头（笔记本）
      console.log('Rear camera not available, trying front camera...')
      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
      })
    }

    isARMode.value = true
    setTimeout(() => {
      if (arVideo.value) {
        arVideo.value.srcObject = stream
      }
    }, 100)
  } catch (err) {
    console.error('Camera error:', err)

    // Provide specific error messages
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      alert(
        'カメラが見つかりません。\n\nAR機能はモバイルデバイスでご利用ください。\n\nデスクトップの場合は、外付けカメラを接続してください。'
      )
    } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      alert('カメラへのアクセスが拒否されました。\n\nブラウザの設定でカメラの使用を許可してください。')
    } else if (err.name === 'NotReadableError') {
      alert('カメラが他のアプリケーションで使用中です。\n\n他のアプリを閉じてから再度お試しください。')
    } else {
      alert('カメラの起動に失敗しました。\n\nエラー: ' + err.message)
    }
    return
  }

  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const response = await DeviceOrientationEvent.requestPermission()
      if (response === 'granted') {
        window.addEventListener('deviceorientation', handleOrientation)
      } else {
        alert('コンパスへのアクセスが拒否されました')
      }
    } catch (e) {
      console.error(e)
    }
  } else {
    window.addEventListener('deviceorientation', handleOrientation)
  }
}

function stopAR() {
  isARMode.value = false
  if (arVideo.value && arVideo.value.srcObject) {
    arVideo.value.srcObject.getTracks().forEach((track) => track.stop())
  }
  window.removeEventListener('deviceorientation', handleOrientation)
}

function handleOrientation(event) {
  if (event.webkitCompassHeading) {
    deviceAlpha.value = event.webkitCompassHeading
  } else if (event.alpha) {
    deviceAlpha.value = 360 - event.alpha
  }
}

function calculateBearing(startLat, startLng, destLat, destLng) {
  const startLatRad = startLat * (Math.PI / 180)
  const startLngRad = startLng * (Math.PI / 180)
  const destLatRad = destLat * (Math.PI / 180)
  const destLngRad = destLng * (Math.PI / 180)

  const y = Math.sin(destLngRad - startLngRad) * Math.cos(destLatRad)
  const x =
    Math.cos(startLatRad) * Math.sin(destLatRad) -
    Math.sin(startLatRad) * Math.cos(destLatRad) * Math.cos(destLngRad - startLngRad)

  let brng = Math.atan2(y, x)
  brng = brng * (180 / Math.PI)
  return (brng + 360) % 360
}

onUnmounted(() => {
  stopAR()
})
</script>

<style scoped>
.leaflet-container {
  height: 100%;
}

/* Mobile responsive styles */
@media (max-width: 768px) {
  /* Left control panel - make it scrollable and compact */
  .control-panel-left {
    max-height: 60vh;
    overflow-y: auto;
    width: calc(100vw - 2rem) !important;
    max-width: 320px;
  }

  /* Right status panel - move to bottom-right and make it compact and scrollable */
  .status-panel-right {
    top: auto !important;
    bottom: 1rem !important;
    right: 0.5rem !important;
    width: calc(100vw - 2rem) !important;
    max-width: 320px;
    max-height: 35vh;
    overflow-y: auto;
    font-size: 11px;
  }

  /* Reduce padding and gaps on mobile */
  .control-panel-left > div,
  .status-panel-right {
    padding: 0.5rem !important;
  }

  .control-panel-left {
    gap: 0.5rem !important;
  }

  /* Make buttons and inputs smaller */
  .control-panel-left button,
  .status-panel-right button {
    padding: 0.4rem 0.6rem !important;
    font-size: 11px !important;
  }

  .control-panel-left select {
    font-size: 11px !important;
    padding: 0.3rem 0.5rem !important;
  }

  /* Make headings smaller */
  .control-panel-left h3 {
    font-size: 11px !important;
    margin-bottom: 0.25rem !important;
  }

  /* Compact text */
  .control-panel-left p,
  .status-panel-right p {
    font-size: 10px !important;
    margin: 0.2rem 0 !important;
  }

  /* Ensure AR button is always visible */
  .ar-button {
    position: sticky !important;
    bottom: 0;
    z-index: 10;
  }
}

/* Very small screens (phones in portrait) */
@media (max-width: 480px) {
  .control-panel-left {
    top: 0.5rem !important;
    left: 0.5rem !important;
    max-height: 50vh;
  }

  .status-panel-right {
    top: auto !important;
    bottom: 0.5rem !important;
    right: 0.5rem !important;
    max-height: 30vh;
  }

  /* Stack buttons vertically on very small screens */
  .button-group {
    flex-direction: column !important;
    width: 100%;
  }

  .button-group button,
  .button-group select {
    width: 100% !important;
  }
}

/* Landscape mode on mobile */
@media (max-width: 768px) and (orientation: landscape) {
  .control-panel-left {
    max-height: 80vh;
  }

  .status-panel-right {
    max-height: 80vh;
  }
}

/* Scrollbar styling for mobile panels */
.control-panel-left::-webkit-scrollbar,
.status-panel-right::-webkit-scrollbar {
  width: 4px;
}

.control-panel-left::-webkit-scrollbar-track,
.status-panel-right::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 2px;
}

.control-panel-left::-webkit-scrollbar-thumb,
.status-panel-right::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 2px;
}

.control-panel-left::-webkit-scrollbar-thumb:hover,
.status-panel-right::-webkit-scrollbar-thumb:hover {
  background: #555;
}

/* AR Overlay mobile responsive styles */
@media (max-width: 768px) {
  .ar-arrow {
    width: 80px !important;
    height: 80px !important;
    border-width: 3px !important;
  }

  .ar-arrow > div {
    border-left-width: 15px !important;
    border-right-width: 15px !important;
    border-bottom-width: 30px !important;
  }

  .ar-info {
    padding: 0.75rem !important;
    max-width: 90vw;
  }

  .ar-info p:first-child {
    font-size: 14px !important;
  }

  .ar-info p:nth-child(2) {
    font-size: 20px !important;
    margin: 0.5rem 0 !important;
  }

  .ar-info p:last-child {
    font-size: 12px !important;
  }

  .ar-close-btn {
    padding: 0.5rem 1rem !important;
    font-size: 14px !important;
    top: 1rem !important;
    right: 1rem !important;
  }
}

@media (max-width: 480px) {
  .ar-arrow {
    width: 64px !important;
    height: 64px !important;
    border-width: 2px !important;
  }

  .ar-arrow > div {
    border-left-width: 12px !important;
    border-right-width: 12px !important;
    border-bottom-width: 24px !important;
  }

  .ar-info {
    padding: 0.5rem !important;
  }

  .ar-info p:first-child {
    font-size: 12px !important;
  }

  .ar-info p:nth-child(2) {
    font-size: 18px !important;
  }

  .ar-info p:last-child {
    font-size: 11px !important;
  }

  .ar-close-btn {
    padding: 0.4rem 0.8rem !important;
    font-size: 12px !important;
  }
}
</style>
