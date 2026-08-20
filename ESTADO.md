# Estado del build — Twin your Neobank

Última actualización: 20/08, madrugada. Deadline: **hoy 18:00**.

## Listo (código completo, build y lint limpios)

- **M1** — balances multi-chain (multicall, 3 requests para 18 pares token/red),
  transfers en `/enviar`, dirección + QR en `/recibir`
- **M2** — vault ARGt Prime en `/ahorro`: depositar con approve automático, retirar
- **M3** — bridge OFT de LayerZero en `/mover`: quote, approve, send, link a LayerZero Scan
- **Bonus** — las 7 stablecoins de Twin en el registry (`src/lib/tokens.ts`)
- Repo público: https://github.com/lainncalvo/twin-neobank

## Verificado contra mainnet (sin gastar gas)

```bash
node scripts/verify-bridge.mjs   # las 6 rutas cotizan OK con el SendParam de la app
node scripts/verify-vault.mjs    # asset correcto, sin gates, previewDeposit responde
```

## Bloqueado, hace falta acción tuya

1. **App ID de Privy** → `.env.local` con `NEXT_PUBLIC_PRIVY_APP_ID=...`
   En dashboard.privy.io: habilitar embedded wallets (create on login), agregar
   Arbitrum/Base/Polygon en Chains, y sumar `localhost:3000` + la URL de Vercel
   en Allowed domains. Sin ese último paso el login falla sin explicar por qué.
2. **Deploy a Vercel** → el plugin `vercel@claude-plugins-official` ya está instalado.
   Después de reiniciar Claude Code hay `/deploy`. Va a pedir `vercel login` (abre
   el navegador, lo tenés que correr vos).

## Falta después de eso

- Entrar de verdad y revisar el diseño de las 5 pantallas
- Probar con plata real: transfer de 1 ARGt, depósito de 10 al vault, bridge de 50 a Base
- Enviar el form de submission (URL hosteada + nombre + email + handle de X)
  antes de las 18:00
