# Como gravar a etiqueta NFC da lixeira

Cada lixeira tem uma etiqueta NFC. Quem encosta o celular nela abre o app do morador já no andar certo e pode marcar o descarte no próprio nome. A etiqueta guarda só um endereço (URL). Não guarda dado de ninguém.

## O que gravar

Um registro do tipo **URL** com o endereço do app e o número do andar:

```
https://tafnerdev.github.io/recicla-app/app/?andar=7
```

Troque o `7` pelo andar da lixeira. Uma etiqueta por andar:

| Andar | Endereço |
|---|---|
| 1º | `https://tafnerdev.github.io/recicla-app/app/?andar=1` |
| 2º | `https://tafnerdev.github.io/recicla-app/app/?andar=2` |
| 3º | `https://tafnerdev.github.io/recicla-app/app/?andar=3` |
| 4º | `https://tafnerdev.github.io/recicla-app/app/?andar=4` |
| 5º | `https://tafnerdev.github.io/recicla-app/app/?andar=5` |
| 6º | `https://tafnerdev.github.io/recicla-app/app/?andar=6` |
| 7º | `https://tafnerdev.github.io/recicla-app/app/?andar=7` |
| 8º | `https://tafnerdev.github.io/recicla-app/app/?andar=8` |
| 9º | `https://tafnerdev.github.io/recicla-app/app/?andar=9` |
| 10º | `https://tafnerdev.github.io/recicla-app/app/?andar=10` |

O endereço tem cerca de 60 caracteres e cabe numa etiqueta **NTAG213** (144 bytes), a mais barata. NTAG215 e NTAG216 também servem.

## Gravando com o celular

Funciona com o app gratuito **NFC Tools** (Android e iPhone).

1. Abra o NFC Tools e vá em **Escrever** (Write).
2. Toque em **Adicionar um registro** e escolha **URL / URI**.
3. Cole o endereço do andar e confirme.
4. Toque em **Escrever** e encoste o celular na etiqueta até aparecer a confirmação.
5. Teste: com a tela destravada, encoste o celular. O navegador deve abrir o app no andar certo.

No Android, o NFC precisa estar ligado nas configurações. No iPhone, a gravação funciona do iPhone 7 em diante. A leitura sem abrir app nenhum funciona do iPhone XS em diante. Nos modelos 7, 8 e X, use o leitor de NFC da Central de Controle.

## Dicas

- **Proteger contra regravação:** o NFC Tools tem a opção de bloquear a etiqueta (Outras > Bloquear etiqueta). O bloqueio é **definitivo**. Só bloqueie depois de testar e com o endereço publicado certo.
- **Lixeira de metal:** metal atrapalha o NFC. Use etiquetas "anti-metal" (com uma camada de ferrite) ou cole a etiqueta numa plaquinha de plástico.
- **Onde colar:** perto da boca da lixeira, na altura da mão, com um desenho de celular e o texto "Encoste para pontuar no seu nome".
- **Celular sem NFC:** imprima também um QR Code com o mesmo endereço ao lado da etiqueta. Qualquer gerador de QR Code serve.

## Para a demonstração

Sem o site publicado, dá para testar com o computador e o celular na mesma rede Wi-Fi, gravando o endereço local do computador (por exemplo `http://192.168.0.10:8080/app/?andar=7`). Fora de `https`, o celular não instala o app nem guarda as telas para usar sem internet. Para o dia do demo, grave o endereço publicado.
