# Twin — tu neobanco

Neobanco construido sobre las stablecoins de [Twin](https://twin.finance) para el hackathon
**Twin your Neobank** (LATAM Digital Assets Conference).

Entrás con tu email o Google, se te crea la cuenta sola, y adentro tenés pesos, reales y soles
en una sola pantalla. Nada de seed phrases ni de pedirle a la gente que instale una extensión.

## Qué hace

| Milestone | Pantalla | Qué resuelve |
|---|---|---|
| **M1** | Inicio · Enviar · Recibir | Balances de ARGt agregados en Arbitrum, Base y Polygon, y transferencias en la red que elijas |
| **M2** | Ahorro | Depositar y retirar ARGt en **ARGt Prime**, un vault ERC-4626 de terceros operado sobre Morpho |
| **M3** | Mover | Pasar ARGt entre Arbitrum, Base y Polygon usando el bridge de Twin |
| **🎁 Bonus** | Todas | El registry cubre las siete stablecoins de Twin: ARGt, BRAt, MEXt, CHLt, COLt, PERt y BOLt |

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind 4 · wagmi 3 + viem 2 · Privy (wallet embebida) ·
Vercel. Sin backend: todo corre en el cliente contra RPCs públicos.

## Cómo correrlo

```bash
npm install
cp .env.example .env.local   # y poné tu NEXT_PUBLIC_PRIVY_APP_ID
npm run dev
```

El App ID sale gratis de [dashboard.privy.io](https://dashboard.privy.io). En la config de la app
hay que habilitar embedded wallets y agregar Arbitrum, Base y Polygon.

## Lo que aprendimos leyendo la cadena

Tres cosas que no están en la documentación y que costaron descubrir. Las verificamos por
`eth_call` contra los contratos en producción, no por suposición.

### El bridge es un OFT Adapter de LayerZero V2

El enunciado habla de "un adapter por chain" y de "indicar la chain de destino". Leyendo el
bytecode aparecen los selectores de LayerZero (`quoteSend`, `quoteOFT`, `peers`, `lzReceive`), y
`oftVersion()` confirma la interfaz. Eso cambia tres cosas de la implementación:

1. **`SendParam.dstEid` es un endpoint ID de LayerZero, no un chain ID.** Ethereum es `30101`,
   Polygon `30109`, Arbitrum `30110`, Base `30184`. Pasar `42161` en vez de `30110` falla sin un
   error que ayude. Verificamos cada ruta contra `peers(uint32)` de los tres adapters.
2. **`approvalRequired()` devuelve `true`** en los tres: es un lockbox, así que hay que hacer
   `approve` del ERC-20 al adapter antes del `send`. Por eso el primer envío pide dos firmas.
3. **`sharedDecimals()` es 6 pero ARGt tiene 18 decimales.** LayerZero trunca el monto a
   múltiplos de `1e12` y el resto se pierde. La app redondea el monto antes de firmar y muestra
   el `amountReceivedLD` real que devuelve `quoteOFT`, así nadie firma un número y recibe otro.

También descubrimos que los adapters ya tienen `enforcedOptions` configuradas (type-3, 300k de
gas para `lzReceive`), así que se puede mandar `extraOptions: '0x'` en vez de construir las
options a mano.

### `maxDeposit()` del vault devuelve 0, pero los depósitos funcionan

`ARGt Prime` es un Morpho Vault V2. Su `maxDeposit(address)` devuelve `0` para cualquier
dirección porque `liquidityAdapter()` es `address(0)`. Leído por ERC-4626 eso significa "el vault
no acepta depósitos", y lo natural es deshabilitar el botón — con lo cual la feature nunca
funciona.

No es así: los gates (`receiveSharesGate`, `receiveAssetsGate`, `sendSharesGate`) son todos
`address(0)`, `canReceiveShares()` devuelve `true` para cualquiera, y hay depósitos reales
recientes en los logs del contrato. La app usa `previewDeposit` y llama `deposit` directo.

### Las direcciones se repiten entre tokens

`0x59863989d080B22476DB95656d0C3CC18be92214` es ARGt en Arbitrum, MEXt en Base y BRAt en Polygon.
El registry de tokens indexa siempre por `(chainId, symbol)`, nunca por dirección sola.

## Contratos

**Vault (M2)** — ARGt Prime (`sARGt`), Morpho Vault V2 en Arbitrum
`0x9Dd3F844747AB78d616BF76DB92756E17A064aDD`

**Bridge (M3)** — OFT Adapters de ARGt
| Red | Adapter | LZ EID |
|---|---|---|
| Arbitrum | `0x4821FBf47B261F0D52Ba0F941CF67b8648f82691` | 30110 |
| Base | `0xe80Af1d12426dB4394b147e04f179a38e7C5Dfe7` | 30184 |
| Polygon | `0xD70ad085684b2A9f4B5d54D7BDB2ecA37a273216` | 30109 |

**ARGt (M1)**
| Red | Contrato |
|---|---|
| Arbitrum | `0x59863989d080B22476DB95656d0C3CC18be92214` |
| Base | `0xf016413834E6D1A14F3D628B11D6Ef725a6bdbDD` |
| Polygon | `0x50464bE58912745447E24EB3bbDedcee10D3E056` |

El resto de las stablecoins está en [`src/lib/tokens.ts`](src/lib/tokens.ts).

---

Twin Stablecoins son instrumentos de pago digital respaldados por reservas. No son valores
negociables ni productos de inversión.
