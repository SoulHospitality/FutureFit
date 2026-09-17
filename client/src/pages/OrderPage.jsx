import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';
import BrandLoader from '../components/ui/BrandLoader';
import { formatMoney, getImageUrl, orderStatusBadge, orderStatusLabel } from '../utils/helpers';

export default function OrderPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);

  useEffect(() => {
    api.get(`/orders/${id}`).then((r) => setOrder(r.data));
  }, [id]);

  if (!order) return <BrandLoader fullPage size="md" label="Loading order" />;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-wide">Order #{order.id.slice(0, 8)}</h1>
          <p className="text-sm text-timber-500 mt-1">
            {new Date(order.createdAt).toLocaleString()}
          </p>
        </div>
        <span className={orderStatusBadge[order.status]}>{orderStatusLabel[order.status]}</span>
      </div>

      <div className="card space-y-4">
        {order.items?.map((item) => (
          <div key={item.id} className="flex gap-3 items-center">
            <img src={getImageUrl(item.image)} alt="" className="w-16 h-16 rounded-lg object-cover" />
            <div className="flex-1">
              <p className="font-medium">{item.name}</p>
              <p className="text-sm text-timber-500">
                Qty {item.qty}
                {item.color ? ` · ${item.color}` : ''}
                {item.size ? ` · Size ${item.size}` : ''}
              </p>
            </div>
            <p className="font-medium">{formatMoney(item.price * item.qty)}</p>
          </div>
        ))}
        <div className="border-t border-timber-100 pt-4 space-y-1 text-sm">
          <div className="flex justify-between"><span>Items</span><span>{formatMoney(order.itemsPrice)}</span></div>
          <div className="flex justify-between"><span>Shipping</span><span>{formatMoney(order.shippingPrice)}</span></div>
          {Number(order.discountAmount) > 0 && (
            <div className="flex justify-between text-green-700">
              <span>Discount {order.couponCode && `(${order.couponCode})`}</span>
              <span>-{formatMoney(order.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base pt-2">
            <span>Total</span><span>{formatMoney(order.totalPrice)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
