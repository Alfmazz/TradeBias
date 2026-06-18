'use client';

export interface VolumeBin {
  price_low: number;
  price_high: number;
  volume: number;
}

interface VolumeProfileProps {
  bins: VolumeBin[];
  pocPrice: number;
}

// Dibuja el perfil de volumen como una pila de barras horizontales,
// una por nivel de precio, de mayor precio (arriba) a menor (abajo) —
// para que quede aproximadamente alineado con el eje de precio del
// gráfico principal, que también tiene los precios altos arriba.
export default function VolumeProfile({ bins, pocPrice }: VolumeProfileProps) {
  if (!bins || bins.length === 0) return null;

  const maxVolume = Math.max(...bins.map((b) => b.volume), 1);
  const sortedBins = [...bins].sort((a, b) => b.price_low - a.price_low);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1px' }}>
      {sortedBins.map((bin) => {
        const widthPct = (bin.volume / maxVolume) * 100;
        const isPoc = pocPrice >= bin.price_low && pocPrice < bin.price_high;
        return (
          <div
            key={bin.price_low}
            style={{ display: 'flex', alignItems: 'center', flex: 1 }}
            title={`$${bin.price_low.toFixed(2)}–$${bin.price_high.toFixed(2)}: ${bin.volume.toLocaleString()} vol`}
          >
            <div
              style={{
                height: '70%',
                width: `${widthPct}%`,
                minWidth: '2px',
                background: isPoc ? '#f5a623' : 'rgba(91, 141, 238, 0.45)',
                borderRadius: '0 3px 3px 0',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}