import MarketCard from "./MarketCard";

// MarketGrid.jsx — 3 col desktop / 2 col tablet / 1 col phone, per spec.

export default function MarketGrid({ markets, onOpenMarket }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {markets.map((market, i) => (
        <MarketCard key={market.id} market={market} index={i} onOpen={onOpenMarket} />
      ))}
    </div>
  );
}
