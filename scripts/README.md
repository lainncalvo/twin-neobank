# scripts

`verify-bridge.mjs` cotiza las seis rutas del bridge (Arbitrum, Base y Polygon entre sí)
contra los contratos en producción, usando el mismo `SendParam` que arma la app.

```bash
node scripts/verify-bridge.mjs
```

Sirve para confirmar que el encoding es correcto sin gastar un peso: si una ruta imprime
`FALLA`, el problema está en el `dstEid` o en las options, no en los fondos.
