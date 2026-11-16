# Sensor pela porta serial

O telão pode receber os descartes direto de um sensor ligado no computador por USB. A leitura vem **desligada**. Ela só aparece quando o endereço do telão termina em `?sensor=1`.

## Protocolo

Uma linha de texto por descarte, terminada em quebra de linha (`\n` ou `\r\n`):

| Linha | Significado |
|---|---|
| `R,7` | descarte **reciclável** no 7º andar |
| `O,7` | descarte **orgânico** no 7º andar |

- Aceita minúsculas e espaços (`r, 7`) e ponto e vírgula (`R;7`).
- Linhas vazias e linhas que começam com `#` são ignoradas. Use `#` para mensagens de conferência do microcontrolador.
- Andar que não existe no prédio, ou letra diferente de R e O, é ignorado e aparece como "Linha ignorada" no painel do sensor.
- Velocidade padrão: **115200 baud**. Para outra velocidade, use `?sensor=1&baud=9600`.

O código que interpreta as linhas está em `js/serial.js` (`interpretarLinha`) e tem teste automatizado em `tests/extras.spec.js`.

## Como ligar no dia

1. Grave o exemplo `docs/esp32/recicla_sensor.ino` no ESP32 (ou qualquer placa que mande as linhas acima).
2. Ligue a placa no computador do telão com um cabo USB **de dados**.
3. Abra o telão no **Chrome ou no Edge do computador** com `?sensor=1`:
   - publicado: `https://SEU-USUARIO.github.io/recicla-app/telao/?sensor=1`
   - local: `http://localhost:8080/telao/?sensor=1` (com `npm run servir`)
4. Clique em **Conectar sensor** e escolha a porta da placa. Ela costuma aparecer como "USB Serial", "CP210x" ou "CH340".
5. O selo no topo muda para **Sensor conectado**. Cada descarte faz a linha do andar brilhar e subir no ranking.
6. Da próxima vez, o telão reconecta sozinho à mesma porta ao abrir, porque o navegador lembra da permissão.

A Web Serial só funciona em `https://` ou em `localhost`. Celulares, Safari e Firefox não têm Web Serial. Nesses casos, o painel avisa "Sensor indisponível".

## Testar sem o sensor

- No painel do sensor (canto direito, embaixo), digite `R,7` em **Testar uma linha** e tecle Enter. A linha passa pelo mesmo caminho de uma linha real.
- No ESP32 de exemplo, o botão **BOOT** manda um `R,<andar>` de teste ao ser solto.

## Se der problema

| Sintoma | O que fazer |
|---|---|
| A porta não aparece na lista | Troque o cabo (muitos só carregam). No Windows, instale o driver CP210x ou CH340 da sua placa. |
| "Não abriu a porta" | Outro programa está usando a porta. Feche o Monitor Serial do Arduino IDE e tente de novo. |
| Conecta, mas nada acontece | Confira a velocidade (`?baud=`) e se a placa termina cada linha com quebra de linha (`Serial.println`). |
| "Linha ignorada" | A linha não está no formato `R,7` / `O,7`, ou o andar não existe no `data/edificio-exemplo.json`. |
| Conta dois descartes por vez | Aumente `BLOQUEIO_MS` no código da placa ou ajuste a altura do sensor. |
| O cabo soltou | O selo vira "Sensor desconectado". Religue e clique em **Conectar sensor**. |

**Plano B:** o painel `/demo/`, aberto no mesmo navegador, registra os descartes à mão (inclusive com o teclado: número do andar e depois `R` ou `O`).
