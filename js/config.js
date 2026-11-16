/**
 * Recicla Slide: ligação com o placar online (Supabase).
 *
 * Vazio = modo local: cada navegador guarda o seu placar, como sempre foi.
 * Preenchido = os prédios abertos com ?predio=CODIGO ficam online.
 *
 * Os dois valores ficam em Project Settings > API, no painel do Supabase.
 * A chave "anon public" é pública por natureza (o próprio Supabase manda usá-la
 * no navegador) e pode ficar no site. NUNCA coloque aqui a chave service_role.
 * O passo a passo está no PENDENCIAS.md.
 */
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';
