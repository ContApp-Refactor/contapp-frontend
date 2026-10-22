// /* ==================== PAÍSES ==================== */
// export const COUNTRIES = [
//   { id: 1, name: 'Colombia' },
//   { id: 2, name: 'Chile' },
//   { id: 3, name: 'Perú' },
//   { id: 4, name: 'Brasil' },
//   { id: 5, name: 'Estados Unidos (USA)' }
// ];

// /* ==================== DEPARTAMENTOS ==================== */
// export const DEPARTMENTS = [
//   // 🇨o COLOMBIA (1)
//   { id: 1, name: 'Amazonas', countryId: 1 },
//   { id: 2, name: 'Antioquia', countryId: 1 },
//   { id: 3, name: 'Arauca', countryId: 1 },
//   { id: 4, name: 'Atlántico', countryId: 1 },
//   { id: 5, name: 'Bolívar', countryId: 1 },
//   { id: 6, name: 'Boyacá', countryId: 1 },
//   { id: 7, name: 'Caldas', countryId: 1 },
//   { id: 8, name: 'Caquetá', countryId: 1 },
//   { id: 9, name: 'Casanare', countryId: 1 },
//   { id: 10, name: 'Cauca', countryId: 1 },
//   { id: 11, name: 'Cesar', countryId: 1 },
//   { id: 12, name: 'Chocó', countryId: 1 },
//   { id: 13, name: 'Córdoba', countryId: 1 },
//   { id: 14, name: 'Cundinamarca', countryId: 1 },
//   { id: 15, name: 'Guainía', countryId: 1 },
//   { id: 16, name: 'Guaviare', countryId: 1 },
//   { id: 17, name: 'Huila', countryId: 1 },
//   { id: 18, name: 'La Guajira', countryId: 1 },
//   { id: 19, name: 'Magdalena', countryId: 1 },
//   { id: 20, name: 'Meta', countryId: 1 },
//   { id: 21, name: 'Nariño', countryId: 1 },
//   { id: 22, name: 'Norte de Santander', countryId: 1 },
//   { id: 23, name: 'Putumayo', countryId: 1 },
//   { id: 24, name: 'Quindío', countryId: 1 },
//   { id: 25, name: 'Risaralda', countryId: 1 },
//   { id: 26, name: 'San Andrés y Providencia', countryId: 1 },
//   { id: 27, name: 'Santander', countryId: 1 },
//   { id: 28, name: 'Sucre', countryId: 1 },
//   { id: 29, name: 'Tolima', countryId: 1 },
//   { id: 30, name: 'Valle del Cauca', countryId: 1 },
//   { id: 31, name: 'Vaupés', countryId: 1 },
//   { id: 32, name: 'Vichada', countryId: 1 },
//   { id: 33, name: 'Bogotá D.C.', countryId: 1 },

//   // 🇨🇱 CHILE (2)
//   { id: 34, name: 'Región Metropolitana', countryId: 2 },
//   { id: 35, name: 'Valparaíso', countryId: 2 },
//   { id: 36, name: 'Biobío', countryId: 2 },
//   { id: 37, name: 'La Araucanía', countryId: 2 },
//   { id: 38, name: 'Antofagasta', countryId: 2 },

//   // 🇵🇪 PERÚ (3)
//   { id: 39, name: 'Lima', countryId: 3 },
//   { id: 40, name: 'Arequipa', countryId: 3 },
//   { id: 41, name: 'Cusco', countryId: 3 },
//   { id: 42, name: 'La Libertad', countryId: 3 },
//   { id: 43, name: 'Piura', countryId: 3 },

//   // 🇧🇷 BRASIL (4)
//   { id: 44, name: 'São Paulo', countryId: 4 },
//   { id: 45, name: 'Rio de Janeiro', countryId: 4 },
//   { id: 46, name: 'Minas Gerais', countryId: 4 },
//   { id: 47, name: 'Bahía', countryId: 4 },
//   { id: 48, name: 'Paraná', countryId: 4 },

//   // 🇺🇸 ESTADOS UNIDOS (5)
//   { id: 49, name: 'California', countryId: 5 },
//   { id: 50, name: 'Texas', countryId: 5 },
//   { id: 51, name: 'Florida', countryId: 5 },
//   { id: 52, name: 'New York', countryId: 5 },
//   { id: 53, name: 'Illinois', countryId: 5 }
// ];

// /* ==================== CIUDADES ==================== */
// export const CITIES = [
//   // 1 Amazonas
//   { id: 1, name: 'Leticia', departmentId: 1 },
//   { id: 2, name: 'Puerto Nariño', departmentId: 1 },
//   { id: 3, name: 'La Chorrera', departmentId: 1 },

//   // 2 Antioquia
//   { id: 4, name: 'Medellín', departmentId: 2 },
//   { id: 5, name: 'Envigado', departmentId: 2 },
//   { id: 6, name: 'Bello', departmentId: 2 },
//   { id: 7, name: 'Rionegro', departmentId: 2 },

//   // 3 Arauca
//   { id: 8, name: 'Arauca', departmentId: 3 },
//   { id: 9, name: 'Saravena', departmentId: 3 },
//   { id: 10, name: 'Tame', departmentId: 3 },

//   // 4 Atlántico
//   { id: 11, name: 'Barranquilla', departmentId: 4 },
//   { id: 12, name: 'Soledad', departmentId: 4 },
//   { id: 13, name: 'Malambo', departmentId: 4 },

//   // 5 Bolívar
//   { id: 14, name: 'Cartagena', departmentId: 5 },
//   { id: 15, name: 'Magangué', departmentId: 5 },
//   { id: 16, name: 'Turbaco', departmentId: 5 },

//   // 6 Boyacá
//   { id: 17, name: 'Tunja', departmentId: 6 },
//   { id: 18, name: 'Duitama', departmentId: 6 },
//   { id: 19, name: 'Sogamoso', departmentId: 6 },

//   // 7 Caldas
//   { id: 20, name: 'Manizales', departmentId: 7 },
//   { id: 21, name: 'La Dorada', departmentId: 7 },
//   { id: 22, name: 'Chinchiná', departmentId: 7 },

//   // 8 Caquetá
//   { id: 23, name: 'Florencia', departmentId: 8 },
//   { id: 24, name: 'San Vicente del Caguán', departmentId: 8 },
//   { id: 25, name: 'Puerto Rico', departmentId: 8 },

//   // 9 Casanare
//   { id: 26, name: 'Yopal', departmentId: 9 },
//   { id: 27, name: 'Aguazul', departmentId: 9 },
//   { id: 28, name: 'Villanueva', departmentId: 9 },

//   // 10 Cauca
//   { id: 29, name: 'Popayán', departmentId: 10 },
//   { id: 30, name: 'Santander de Quilichao', departmentId: 10 },
//   { id: 31, name: 'Puerto Tejada', departmentId: 10 },

//   // 11 Cesar
//   { id: 32, name: 'Valledupar', departmentId: 11 },
//   { id: 33, name: 'Aguachica', departmentId: 11 },
//   { id: 34, name: 'La Jagua de Ibirico', departmentId: 11 },

//   // 12 Chocó
//   { id: 35, name: 'Quibdó', departmentId: 12 },
//   { id: 36, name: 'Istmina', departmentId: 12 },
//   { id: 37, name: 'Tadó', departmentId: 12 },

//   // 13 Córdoba
//   { id: 38, name: 'Montería', departmentId: 13 },
//   { id: 39, name: 'Cereté', departmentId: 13 },
//   { id: 40, name: 'Sahagún', departmentId: 13 },

//   // 14 Cundinamarca
//   { id: 41, name: 'Bogotá', departmentId: 14 },
//   { id: 42, name: 'Soacha', departmentId: 14 },
//   { id: 43, name: 'Zipaquirá', departmentId: 14 },
//   { id: 44, name: 'Chía', departmentId: 14 },

//   // 15 Guainía
//   { id: 45, name: 'Inírida', departmentId: 15 },
//   { id: 46, name: 'Barranco Minas', departmentId: 15 },
//   { id: 47, name: 'Mapiripana', departmentId: 15 },

//   // 16 Guaviare
//   { id: 48, name: 'San José del Guaviare', departmentId: 16 },
//   { id: 49, name: 'Calamar', departmentId: 16 },
//   { id: 50, name: 'El Retorno', departmentId: 16 },

//   // 17 Huila
//   { id: 51, name: 'Neiva', departmentId: 17 },
//   { id: 52, name: 'Pitalito', departmentId: 17 },
//   { id: 53, name: 'Garzón', departmentId: 17 },

//   // 18 La Guajira
//   { id: 54, name: 'Riohacha', departmentId: 18 },
//   { id: 55, name: 'Maicao', departmentId: 18 },
//   { id: 56, name: 'Uribia', departmentId: 18 },

//   // 19 Magdalena
//   { id: 57, name: 'Santa Marta', departmentId: 19 },
//   { id: 58, name: 'Ciénaga', departmentId: 19 },
//   { id: 59, name: 'Fundación', departmentId: 19 },

//   // 20 Meta
//   { id: 60, name: 'Villavicencio', departmentId: 20 },
//   { id: 61, name: 'Acacías', departmentId: 20 },
//   { id: 62, name: 'Granada', departmentId: 20 },

//   // 21 Nariño
//   { id: 63, name: 'Pasto', departmentId: 21 },
//   { id: 64, name: 'Tumaco', departmentId: 21 },
//   { id: 65, name: 'Ipiales', departmentId: 21 },

//   // 22 Norte de Santander
//   { id: 66, name: 'Cúcuta', departmentId: 22 },
//   { id: 67, name: 'Ocaña', departmentId: 22 },
//   { id: 68, name: 'Villa del Rosario', departmentId: 22 },

//   // 23 Putumayo
//   { id: 69, name: 'Mocoa', departmentId: 23 },
//   { id: 70, name: 'Puerto Asís', departmentId: 23 },
//   { id: 71, name: 'Orito', departmentId: 23 },

//   // 24 Quindío
//   { id: 72, name: 'Armenia', departmentId: 24 },
//   { id: 73, name: 'Calarcá', departmentId: 24 },
//   { id: 74, name: 'Montenegro', departmentId: 24 },

//   // 25 Risaralda
//   { id: 75, name: 'Pereira', departmentId: 25 },
//   { id: 76, name: 'Dosquebradas', departmentId: 25 },
//   { id: 77, name: 'Santa Rosa de Cabal', departmentId: 25 },

//   // 26 San Andrés
//   { id: 78, name: 'San Andrés', departmentId: 26 },
//   { id: 79, name: 'Providencia', departmentId: 26 },
//   { id: 80, name: 'Santa Catalina', departmentId: 26 },

//   // 27 Santander
//   { id: 81, name: 'Bucaramanga', departmentId: 27 },
//   { id: 82, name: 'Floridablanca', departmentId: 27 },
//   { id: 83, name: 'Girón', departmentId: 27 },

//   // 28 Sucre
//   { id: 84, name: 'Sincelejo', departmentId: 28 },
//   { id: 85, name: 'Corozal', departmentId: 28 },
//   { id: 86, name: 'Sampués', departmentId: 28 },

//   // 29 Tolima
//   { id: 87, name: 'Ibagué', departmentId: 29 },
//   { id: 88, name: 'Espinal', departmentId: 29 },
//   { id: 89, name: 'Melgar', departmentId: 29 },

//   // 30 Valle del Cauca
//   { id: 90, name: 'Cali', departmentId: 30 },
//   { id: 91, name: 'Palmira', departmentId: 30 },
//   { id: 92, name: 'Buenaventura', departmentId: 30 },

//   // 31 Vaupés
//   { id: 93, name: 'Mitú', departmentId: 31 },
//   { id: 94, name: 'Carurú', departmentId: 31 },
//   { id: 95, name: 'Taraira', departmentId: 31 },

//   // 32 Vichada
//   { id: 96, name: 'Puerto Carreño', departmentId: 32 },
//   { id: 97, name: 'La Primavera', departmentId: 32 },
//   { id: 98, name: 'Santa Rosalía', departmentId: 32 },

//   // 33 Bogotá D.C.
//   { id: 99, name: 'Bogotá Centro', departmentId: 33 },
//   { id: 100, name: 'Usaquén', departmentId: 33 },
//   { id: 101, name: 'Suba', departmentId: 33 },

//   // 34 Región Metropolitana
//   { id: 102, name: 'Santiago', departmentId: 34 },
//   { id: 103, name: 'Puente Alto', departmentId: 34 },
//   { id: 104, name: 'Maipú', departmentId: 34 },

//   // 35 Valparaíso
//   { id: 105, name: 'Valparaíso', departmentId: 35 },
//   { id: 106, name: 'Viña del Mar', departmentId: 35 },
//   { id: 107, name: 'Quilpué', departmentId: 35 },

//   // 36 Biobío
//   { id: 108, name: 'Concepción', departmentId: 36 },
//   { id: 109, name: 'Talcahuano', departmentId: 36 },
//   { id: 110, name: 'Los Ángeles', departmentId: 36 },

//   // 37 La Araucanía
//   { id: 111, name: 'Temuco', departmentId: 37 },
//   { id: 112, name: 'Villarrica', departmentId: 37 },
//   { id: 113, name: 'Angol', departmentId: 37 },

//   // 38 Antofagasta
//   { id: 114, name: 'Antofagasta', departmentId: 38 },
//   { id: 115, name: 'Calama', departmentId: 38 },
//   { id: 116, name: 'Tocopilla', departmentId: 38 },


//   // 🇵🇪 PERÚ (3)

//   // 39 Lima
//   { id: 117, name: 'Lima', departmentId: 39 },
//   { id: 118, name: 'Miraflores', departmentId: 39 },
//   { id: 119, name: 'San Isidro', departmentId: 39 },

//   // 40 Arequipa
//   { id: 120, name: 'Arequipa', departmentId: 40 },
//   { id: 121, name: 'Camaná', departmentId: 40 },
//   { id: 122, name: 'Mollendo', departmentId: 40 },

//   // 41 Cusco
//   { id: 123, name: 'Cusco', departmentId: 41 },
//   { id: 124, name: 'Urubamba', departmentId: 41 },
//   { id: 125, name: 'Sicuani', departmentId: 41 },

//   // 42 La Libertad
//   { id: 126, name: 'Trujillo', departmentId: 42 },
//   { id: 127, name: 'Chepén', departmentId: 42 },
//   { id: 128, name: 'Pacasmayo', departmentId: 42 },

//   // 43 Piura
//   { id: 129, name: 'Piura', departmentId: 43 },
//   { id: 130, name: 'Sullana', departmentId: 43 },
//   { id: 131, name: 'Talara', departmentId: 43 },


//   // 🇧🇷 BRASIL (4)

//   // 44 São Paulo
//   { id: 132, name: 'São Paulo', departmentId: 44 },
//   { id: 133, name: 'Campinas', departmentId: 44 },
//   { id: 134, name: 'Santos', departmentId: 44 },

//   // 45 Rio de Janeiro
//   { id: 135, name: 'Rio de Janeiro', departmentId: 45 },
//   { id: 136, name: 'Niterói', departmentId: 45 },
//   { id: 137, name: 'Petrópolis', departmentId: 45 },

//   // 46 Minas Gerais
//   { id: 138, name: 'Belo Horizonte', departmentId: 46 },
//   { id: 139, name: 'Uberlândia', departmentId: 46 },
//   { id: 140, name: 'Ouro Preto', departmentId: 46 },

//   // 47 Bahía
//   { id: 141, name: 'Salvador', departmentId: 47 },
//   { id: 142, name: 'Feira de Santana', departmentId: 47 },
//   { id: 143, name: 'Ilhéus', departmentId: 47 },

//   // 48 Paraná
//   { id: 144, name: 'Curitiba', departmentId: 48 },
//   { id: 145, name: 'Londrina', departmentId: 48 },
//   { id: 146, name: 'Maringá', departmentId: 48 },


//   // 🇺🇸 ESTADOS UNIDOS (5)

//   // 49 California
//   { id: 147, name: 'Los Angeles', departmentId: 49 },
//   { id: 148, name: 'San Francisco', departmentId: 49 },
//   { id: 149, name: 'San Diego', departmentId: 49 },

//   // 50 Texas
//   { id: 150, name: 'Houston', departmentId: 50 },
//   { id: 151, name: 'Dallas', departmentId: 50 },
//   { id: 152, name: 'Austin', departmentId: 50 },

//   // 51 Florida
//   { id: 153, name: 'Miami', departmentId: 51 },
//   { id: 154, name: 'Orlando', departmentId: 51 },
//   { id: 155, name: 'Tampa', departmentId: 51 },

//   // 52 New York
//   { id: 156, name: 'New York City', departmentId: 52 },
//   { id: 157, name: 'Buffalo', departmentId: 52 },
//   { id: 158, name: 'Rochester', departmentId: 52 },

//   // 53 Illinois
//   { id: 159, name: 'Chicago', departmentId: 53 },
//   { id: 160, name: 'Springfield', departmentId: 53 },
//   { id: 161, name: 'Naperville', departmentId: 53 }
// ];
