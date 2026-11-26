"use client";

export default function CheckoutSummary({
  items = [],
  biayaLayanan = 0,
  diskon = 0,
  total,
}) {
  const formatRupiah = (n) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(n || 0);

  const normalSubtotal = items.reduce(
    (acc, item) => acc + (item.base_price ?? item.harga) * item.jumlah,
    0
  );
  const derivedDiskon = items.reduce((acc, item) => {
    const base = item.base_price ?? item.harga;
    return acc + Math.max(0, base - item.harga) * item.jumlah;
  }, 0);
  const effectiveDiskon = diskon > 0 ? diskon : derivedDiskon;
  const activePhaseInfo = items.find((item) => item.active_phase)?.active_phase || null;

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs transition-colors dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white">
        Ringkasan Pembayaran
      </h3>

      <div className="mt-4 space-y-3">
        {items.map((item, i) => {
          const unitNormal = item.base_price ?? item.harga;
          const hasPhaseDiscount = unitNormal > item.harga;
          return (
            <div
              key={item.ticket_type_id || item.id || i}
              className="flex items-center justify-between text-xs"
            >
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-200">
                  {item.nama} × {item.jumlah}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {hasPhaseDiscount ? (
                    <>
                      <span className="line-through opacity-75">{formatRupiah(unitNormal)}</span>{" "}
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">
                        {formatRupiah(item.harga)}
                      </span>{" "}
                      / tiket
                    </>
                  ) : (
                    <>{formatRupiah(item.harga)} / tiket</>
                  )}
                </p>
              </div>
              <span className="font-semibold text-slate-900 dark:text-white">
                {formatRupiah(unitNormal * item.jumlah)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-xs dark:border-slate-800">
        <div className="flex justify-between text-slate-500 dark:text-slate-400">
          <span>Harga Normal</span>
          <span className="font-medium text-slate-900 dark:text-white">
            {formatRupiah(normalSubtotal)}
          </span>
        </div>

        {biayaLayanan > 0 && (
          <div className="flex justify-between text-slate-500 dark:text-slate-400">
            <span>Biaya layanan</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {formatRupiah(biayaLayanan)}
            </span>
          </div>
        )}

        {effectiveDiskon > 0 && (
          <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
            <span>
              Diskon Fase
              {activePhaseInfo?.discount_percent != null
                ? ` (${activePhaseInfo.discount_percent}%)`
                : ""}
            </span>
            <span className="font-medium">-{formatRupiah(effectiveDiskon)}</span>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
        <span className="font-semibold text-sm text-slate-900 dark:text-white">
          Total Pembayaran
        </span>
        <span className="text-lg font-bold text-[#0080f2]">
          {formatRupiah(total)}
        </span>
      </div>

      <p className="mt-4 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
        Saat pesanan dikonfirmasi, server akan mengunci kuota tiket selama{" "}
        <strong className="font-medium text-slate-700 dark:text-slate-200">
          15 menit
        </strong>{" "}
        dan menerbitkan kode booking unik beserta tautan pembayaran Midtrans.
      </p>
    </div>
  );
}
