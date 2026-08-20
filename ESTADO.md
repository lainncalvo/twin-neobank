# Estado del build — Twin your Neobank

Última actualización: 20/08, madrugada. Deadline: **hoy 18:00**.

## Listo (código completo, build y lint limpios)

- **M1** — balances multi-chain (multicall, 3 requests para 18 pares token/red),
  transfers en `/enviar`, dirección + QR en `/recibir`
- **M2** — vault ARGt Prime en `/ahorro`: depositar con approve automático, retirar
- **M3** — bridge OFT de LayerZero en `/mover`: quote, approve, send, link a LayerZero Scan
- **Bonus** — las 7 stablecoins de Twin en el registry (`src/lib/tokens.ts`)
- Repo público: https://github.com/lainncalvo/twin-neobank

## Probado con plata real (mainnet, Arbitrum)

- **M1 balances** — la wallet de Privy leyo 1.593,00 ARGt con el desglose por red OK
- **M1 transfer** — 2 ARGt, `success`, un solo evento Transfer, 42.919 de gas:
  https://arbiscan.io/tx/0x6991b7c443760735391a95ca553b11ffa071948d81c3cec71fb19c4bca74ed4d
- **M2 vault** — depositados 10 ARGt, acuno 9,953078 sARGt (share price > 1, el vault
  ya devengo rendimiento; no es una comision). Evento `Deposit` con assets y shares OK:
  https://arbiscan.io/tx/0x6a324938b6b765368652754b3f255fe5e117511a483b104b9b89cf238aa21008
- **M3 bridge** — 20 ARGt de Arbitrum a Base. Fee de LayerZero 0,0000269 ETH, `OFTSent`
  con dstEid 30184 (Base), sent = received = 20, sin slippage. Mensaje **DELIVERED** y
  los 20 ARGt confirmados en el balance de Base:
  https://layerzeroscan.com/tx/0x04234f70199d3eacdd8cabc218d395f179d53cd95f6ddeec2207b2cd1d2a1ac9

Sin probar todavia: **retirar del vault** y la pantalla `/recibir`.

## Features nuevas (post-milestones)

- **Monedas fuertes** — USDC, USDT y EURC en el registry. Las 7 direcciones
  verificadas nativas (no las bridgeadas) con `scripts/verify-tokens.mjs`. La home
  separa "Dolares y euros" de "Monedas de la region".
- **Dolarizar** (`/cambiar`) — ARGt a USDC en el pool de Uniswap V4 que usa Twin en
  Base. Un par y un sentido: se chequearon las 5 stablecoins de Twin que viven en
  Base contra USDC en los 4 fee tiers y solo ARGt/USDC tiene liquidez; el sentido
  inverso revierte con montos minimos.
  **PROBADO CON PLATA REAL**: 10 ARGt -> 0,006215 USDC, `success`, via UniversalRouter
  (selector `0x3593564c`) contra el PoolManager de V4, 172.872 de gas.
  https://basescan.org/tx/0x52a714ba37d29f1bc58c197ed085a27ce3f38835743d625b28e9ebdd42bcfed3
- **Movimientos** (`/movimientos`) — historial leido de los logs de las 3 redes, sin
  indexer ni backend. Agrupa por transaccion para que un swap sea una fila.
  Probado contra la wallet real: encuentra las 5 operaciones con etiqueta correcta.
- **Moneda nativa** — ver el saldo de ETH (Arbitrum + Base) y POL (Polygon) en la
  seccion "Para pagar red" del inicio, y enviarlos desde `/enviar`. El boton de
  maximo reserva gas: el saldo entero no se puede mandar porque la comision se paga
  con la misma moneda. Verificado con `scripts/verify-native.mjs`.
  **Sin probar todavia con plata real.**

## Dos cosas de infraestructura que aparecieron

1. `mainnet.base.org` corta `eth_getLogs` en 10.000 bloques (~5 h de historia) y
   contesta `over rate limit` con pocas llamadas seguidas. Por eso `src/lib/logs.ts`
   arma clientes propios contra los gateways de Tenderly, aislados de `wagmi.ts`.
2. `wagmi.ts` ahora arma los transports con `fallback`. Aditivo: el suplente entra
   solo cuando el primario falla.

## Limitacion conocida

`/movimientos` **no** muestra los envios de moneda nativa. Las transferencias
nativas no emiten logs, `useHistory` filtra por `event Transfer`, y ningun RPC
publico disponible expone `trace_filter` ni `alchemy_getAssetTransfers`. No es un
bug: mostrarlos requeriria escanear las transacciones de cada bloque o un indexer.

## Lo unico sin probar con plata real

El envio de moneda nativa (ETH y POL). Todo lo demas ya se firmo en mainnet:
balances, transfers, vault, bridge y dolarizar.

## Verificado contra mainnet (sin gastar gas)

```bash
node scripts/verify-bridge.mjs   # las 6 rutas cotizan OK con el SendParam de la app
node scripts/verify-vault.mjs    # asset correcto, sin gates, previewDeposit responde
```

## Privy conectado

`.env.local` tiene `NEXT_PUBLIC_PRIVY_APP_ID=cmt0zze4800bg0ckye2i3p32f`.
Login probado end to end en `localhost:3000`: entra con email, Privy crea la
embedded wallet sola y cae en la home. Sin errores de consola.

Embedded wallets y chains NO son settings del dashboard, son config de codigo y ya
estan puestos en `src/app/providers.tsx` (`createOnLogin`, `defaultChain`,
`supportedChains`). No busques toggles en el dashboard.

Pendiente opcional de seguridad: en dashboard.privy.io, Configuration > App settings
> Domains > Allowed Origins, sumar `https://twin-neobank.vercel.app`. Hoy la lista
esta vacia, que en Privy significa sin restriccion; por eso el login anda en
cualquier dominio. No bloquea el demo, evita que otro reuse el App ID.

## Deploy

Vive en **https://twin-neobank.vercel.app** (proyecto `twin-neobank`, conectado al
repo de GitHub, auto-deploy en cada push a `main`). Verificado publico: 200 desde un
browser sin sesion, sin muro de login de Vercel.

## Bloqueado, hace falta acción tuya

1. **`NEXT_PUBLIC_PRIVY_APP_ID` en Vercel** → el deploy muestra el cartel "Falta
   configurar Privy" porque la variable no existe alla (`.env.local` no se sube a git).
   Ponerla en Settings > Environment Variables, los tres environments, y **redeployar**:
   las `NEXT_PUBLIC_` se hornean en el build, no se leen en vivo.

## Falta después de eso

- Entrar de verdad y revisar el diseño de las 5 pantallas
- Probar con plata real: transfer de 1 ARGt, depósito de 10 al vault, bridge de 50 a Base
- Enviar el form de submission (URL hosteada + nombre + email + handle de X)
  antes de las 18:00
