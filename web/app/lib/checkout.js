// Stored selection carries identity/quantity only; prices and stock come from Flask.
export function reconcileCheckout(selection, response) {
  const detail = response?.data;
  const selected = selection?.items;
  if (!response?.success || !detail?.event || !Array.isArray(detail.ticket_types) ||
      !Array.isArray(selected) || selected.length !== 1 ||
      Number(detail.event.id) !== Number(selection.eventId)) {
    throw new Error('Pilihan tiket tidak valid. Pilih kembali dari detail event.');
  }
  const quantity = Number(selected[0].jumlah);
  const type = detail.ticket_types.find((item) => Number(item.id) === Number(selected[0].ticket_type_id || selected[0].id));
  if (!type || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    throw new Error('Kategori atau jumlah tiket tidak valid. Maksimal 10 tiket per transaksi.');
  }
  const stock = type.stock_available;
  const price = type.final_price;
  if (typeof stock !== 'number' || !Number.isFinite(stock) || quantity > stock) {
    throw new Error('Stok tiket tidak mencukupi atau belum dapat diverifikasi.');
  }
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
    throw new Error('Harga tiket belum dapat diverifikasi.');
  }
  const basePrice = typeof type.base_price === 'number' && Number.isFinite(type.base_price) ? type.base_price : price;
  const discountAmount = typeof type.discount_amount === 'number' && Number.isFinite(type.discount_amount)
    ? type.discount_amount
    : Math.max(0, basePrice - price);
  return {
    ...selection,
    eventNama: detail.event.name,
    eventTanggal: detail.event.event_date,
    venue: detail.event.venue,
    lokasi: detail.event.city,
    items: [{
      ...selected[0],
      id: type.id,
      ticket_type_id: type.id,
      nama: type.name,
      base_price: basePrice,
      harga: price,
      discount_amount: discountAmount,
      active_phase: type.active_phase || null,
      jumlah: quantity,
    }],
  };
}
