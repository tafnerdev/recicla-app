/*
  Recicla Slide: exemplo de sensor de descarte para ESP32
  ======================================================

  O que faz
    Cada boca da lixeira tem um sensor. Quando algo passa pela boca, o ESP32
    manda uma linha pela USB (porta serial) para o telão:
      R,7   descarte reciclável no 7º andar
      O,7   descarte orgânico no 7º andar
    O telão (/telao/?sensor=1, no Chrome ou Edge do computador) lê essas linhas
    e soma 10 pontos para o andar. Veja docs/sensor-serial.md.

  Material (exemplo)
    - 1 placa ESP32 com USB (qualquer DevKit)
    - 2 sensores infravermelhos de obstáculo com saída digital (um por boca),
      por exemplo módulos do tipo FC-51 ou TCRT5000. Barreira infravermelha
      (emissor de um lado, receptor do outro) também funciona e erra menos.
    - Fios e um cabo USB de dados (não só de carga)

  Ligação
    Sensor da boca RECICLÁVEL:  VCC -> 3V3   GND -> GND   OUT -> GPIO 27
    Sensor da boca ORGÂNICO:    VCC -> 3V3   GND -> GND   OUT -> GPIO 26
    LED da placa (GPIO 2) pisca a cada descarte.
    Botão BOOT (GPIO 0): segure e solte para mandar um descarte de teste.

  Como gravar
    1. Arduino IDE > Placas: instale "esp32" (Espressif) e escolha "ESP32 Dev Module".
    2. Ajuste ANDAR e os pinos abaixo, se precisar.
    3. Grave. Abra o Monitor Serial em 115200 para ver as linhas.
    4. FECHE o Monitor Serial antes de conectar no telão: a porta só pode ter
       um programa aberto por vez.

  Ajustes finos
    - Se o módulo mandar LOW quando detecta (o mais comum nos FC-51), deixe
      ATIVO_EM_BAIXO = true. Se for o contrário, troque para false.
    - BLOQUEIO_MS evita contar o mesmo descarte duas vezes (saco que balança).
    - Para um prédio inteiro, acrescente mais linhas em SENSORES, uma por boca,
      cada uma com o seu andar.
*/

const unsigned long VELOCIDADE = 115200;  // o telão usa 115200 por padrão (?baud=... muda)
const uint8_t ANDAR = 7;                   // andar desta lixeira
const bool ATIVO_EM_BAIXO = true;          // saída do módulo em LOW quando detecta
const unsigned long ESTAVEL_MS = 25;       // a leitura precisa ficar firme por este tempo (filtro de ruído)
const unsigned long BLOQUEIO_MS = 900;     // tempo mínimo entre dois descartes na mesma boca
const uint8_t PINO_LED = 2;
const uint8_t PINO_TESTE = 0;              // botão BOOT da placa

struct Sensor {
  uint8_t pino;
  char tipo;  // 'R' reciclável, 'O' orgânico
  uint8_t andar;
  bool leitura;              // última leitura bruta
  unsigned long mudouEm;     // quando a leitura bruta mudou
  bool ocupado;              // algo está passando agora
  unsigned long ultimoEnvio; // último descarte enviado
};

Sensor SENSORES[] = {
  {27, 'R', ANDAR, false, 0, false, 0},
  {26, 'O', ANDAR, false, 0, false, 0},
};
const size_t TOTAL_SENSORES = sizeof(SENSORES) / sizeof(SENSORES[0]);

unsigned long ledAteMs = 0;
bool testeAnterior = false;
unsigned long testeMudouEm = 0;

void enviar(char tipo, uint8_t andar) {
  Serial.print(tipo);
  Serial.print(',');
  Serial.println(andar);
  digitalWrite(PINO_LED, HIGH);
  ledAteMs = millis() + 120;
}

void setup() {
  Serial.begin(VELOCIDADE);
  pinMode(PINO_LED, OUTPUT);
  pinMode(PINO_TESTE, INPUT_PULLUP);
  for (size_t i = 0; i < TOTAL_SENSORES; i++) {
    pinMode(SENSORES[i].pino, INPUT_PULLUP);
  }
  delay(300);
  // Linhas que começam com # são ignoradas pelo telão: servem só para conferência.
  Serial.println("# Recicla Slide: sensor pronto");
}

void loop() {
  const unsigned long agora = millis();

  for (size_t i = 0; i < TOTAL_SENSORES; i++) {
    Sensor &s = SENSORES[i];
    const bool detectando = (digitalRead(s.pino) == (ATIVO_EM_BAIXO ? LOW : HIGH));

    if (detectando != s.leitura) {
      s.leitura = detectando;
      s.mudouEm = agora;
    }
    if (agora - s.mudouEm < ESTAVEL_MS) continue;  // ainda oscilando

    if (detectando && !s.ocupado) {
      s.ocupado = true;  // começou uma passagem: conta uma vez só
      if (agora - s.ultimoEnvio >= BLOQUEIO_MS) {
        s.ultimoEnvio = agora;
        enviar(s.tipo, s.andar);
      }
    } else if (!detectando && s.ocupado) {
      s.ocupado = false;  // a boca ficou livre de novo
    }
  }

  // Botão BOOT: descarte de teste (reciclável) ao soltar o botão, com filtro de 50 ms.
  const bool testeApertado = digitalRead(PINO_TESTE) == LOW;
  if (testeApertado != testeAnterior && agora - testeMudouEm > 50) {
    testeMudouEm = agora;
    if (!testeApertado) enviar('R', ANDAR);
    testeAnterior = testeApertado;
  }

  if (ledAteMs && agora > ledAteMs) {
    digitalWrite(PINO_LED, LOW);
    ledAteMs = 0;
  }
}
