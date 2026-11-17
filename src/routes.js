
const Home = () => import("./views/Home.vue");
const NotFound = () => import("./views/NotFound.vue");

/** @type {import('vue-router').RouterOptions['routes']} */
export const routes = [
  { path: "/", component: Home, meta: { title: "Home" } },
  { path: "/:path(.*)", component: NotFound },
];
