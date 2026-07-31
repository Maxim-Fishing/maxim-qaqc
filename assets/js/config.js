// ============================================================
//  CONFIGURACION  ·  MAXIM QA/QC INSUMOS
//  Rellena estos dos valores cuando tengas tu proyecto en Supabase.
//  Los encuentras en:  Supabase → Project Settings → API
//  Mientras esten vacios, la app funciona en MODO DEMO con los datos del Excel.
// ============================================================

window.APP_CONFIG = {
  SUPABASE_URL: "https://mzxwiuqluhouaojaipaq.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable__Oiy5JdpaAtguJsqpQxaxA_nZtFUu4M",   // publishable key (segura para navegador con RLS)

  // Nombre del bucket de Storage donde se guardan los PDF de fichas tecnicas
  BUCKET_FICHAS: "fichas",

  // Marca / textos
  APP_NOMBRE: "MAXIM · QA/QC Insumos",
};

// No editar debajo de esta linea -------------------------------
window.APP_CONFIG.DEMO = !window.APP_CONFIG.SUPABASE_URL || !window.APP_CONFIG.SUPABASE_ANON_KEY;
