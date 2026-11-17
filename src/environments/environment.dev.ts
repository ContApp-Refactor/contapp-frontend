export const environment = {
  production: true,
  // [UNICAUCA] original: keycloak_url: 'http://contables.unicauca.edu.co/dev/api/keycloak/',
  keycloak_url: '/api/keycloak/',
  // [UNICAUCA] original: keycloak_url_token: 'http://contables.unicauca.edu.co/dev/api/keycloak/token/',
  keycloak_url_token: '/api/keycloak/token/',
  // [UNICAUCA] original: API_URL: 'http://contables.unicauca.edu.co/dev/api/',
  API_URL: '/api/',
  /** Solo UI DEV: precarga el correo en login; la contraseña siempre la ingresa el usuario. */
  // [UNICAUCA] original: defaultLoginUsername: 'contables2@unicauca.edu.co',
  defaultLoginUsername: '',
};
