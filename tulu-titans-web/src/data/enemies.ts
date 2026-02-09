
export interface Enemy {
  name: string;
  image: string;
  health: number;
  attack: number;
}

export const enemies: Enemy[] = [
  {
    name: 'Gorgon',
    image: '/images/monsters/imgi_11_OIP.jpg',
    health: 100,
    attack: 20,
  },
  {
    name: 'Harpy',
    image: '/images/monsters/imgi_12_OIP.jpg',
    health: 80,
    attack: 25,
  },
  {
    name: 'Hydra',
    image: '/images/monsters/imgi_14_OIP.jpg',
    health: 120,
    attack: 15,
  },
  {
    name: 'Minotaur',
    image: '/images/monsters/imgi_15_OIP.jpg',
    health: 150,
    attack: 10,
  },
  {
    name: 'Cyclops',
    image: '/images/monsters/imgi_16_OIP.jpg',
    health: 200,
    attack: 5,
  },
  {
    name: 'Griffin',
    image: '/images/monsters/imgi_17_OIP.jpg',
    health: 130,
    attack: 18,
  },
  {
    name: 'Chimera',
    image: '/images/monsters/imgi_18_OIP.jpg',
    health: 140,
    attack: 22,
  },
  {
    name: 'Cerberus',
    image: '/images/monsters/imgi_19_OIP.jpg',
    health: 160,
    attack: 12,
  },
  {
    name: 'Manticore',
    image: '/images/monsters/imgi_2_OIP.jpg',
    health: 110,
    attack: 30,
  },
  {
    name: 'Centaur',
    image: '/images/monsters/imgi_20_OIP.jpg',
    health: 90,
    attack: 28,
  },
  {
    name: 'Satyr',
    image: '/images/monsters/imgi_22_OIP.jpg',
    health: 70,
    attack: 35,
  },
  {
    name: 'Siren',
    image: '/images/monsters/imgi_23_OIP.jpg',
    health: 60,
    attack: 40,
  },
  {
    name: 'Medusa',
    image: '/images/monsters/imgi_24_OIP.jpg',
    health: 180,
    attack: 8,
  },
  {
    name: 'Kraken',
    image: '/images/monsters/imgi_26_OIP.jpg',
    health: 250,
    attack: 3,
  },
  {
    name: 'Dragon',
    image: '/images/monsters/imgi_27_OIP.jpg',
    health: 300,
    attack: 2,
  },
  {
    name: 'Wyvern',
    image: '/images/monsters/imgi_29_OIP.jpg',
    health: 220,
    attack: 4,
  },
  {
    name: 'Phoenix',
    image: '/images/monsters/imgi_3_OIP.jpg',
    health: 100,
    attack: 20,
  },
  {
    name: 'Pegasus',
    image: '/images/monsters/imgi_30_OIP.jpg',
    health: 100,
    attack: 20,
  },
  {
    name: 'Unicorn',
    image: '/images/monsters/imgi_32_OIP.jpg',
    health: 100,
    attack: 20,
  },
  {
    name: 'Goblin',
    image: '/images/monsters/imgi_33_OIP.jpg',
    health: 50,
    attack: 10,
  },
];
