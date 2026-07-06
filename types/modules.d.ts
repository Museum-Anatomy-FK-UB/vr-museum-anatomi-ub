// A-Frame tidak menyertakan type declaration sendiri. Diperlakukan sebagai
// side-effect import — hanya mendaftarkan custom element ke window saat runtime.
// File ini AMBIENT (tanpa import/export) supaya deklarasi module berlaku global.
declare module 'aframe';
