import { createApp } from 'vue'
import './tailwind.css'
import App from './App.vue'
import { routes } from './routes.js'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia } from 'pinia'
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';




const app = createApp(App)

const router = createRouter({
  history: createWebHistory(),
  routes,
})
const pinia = createPinia()
app.use(router)
app.use(createPinia)
app.mount('#app')
