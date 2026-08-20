# scripts

`verify-bridge.mjs` cotiza las seis rutas del bridge (Arbitrum, Base y Polygon entre sí)
contra los contratos en producción, usando el mismo `SendParam` que arma la app.

```bash
node scripts/verify-bridge.mjs
```

Sirve para confirmar que el encoding es correcto sin gastar un peso: si una ruta imprime
`FALLA`, el problema está en el `dstEid` o en las options, no en los fondos.

`verify-vault.mjs` lee el vault ARGt Prime en Arbitrum: confirma el asset, que no tiene gates
de permisos, y deja registrado que `maxDeposit()` devuelve 0 aunque los depósitos funcionen.

```bash
node scripts/verify-vault.mjs
```
