import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

type Coupon = {
  id: number;
  code: string;
  description: string | null;
  type: "percent" | "fixed";
  value: number;
  minOrder: number;
  active: boolean;
};

type LoyaltyProgramType = "points" | "cashback" | "points_cashback" | "custom";

type BusinessSettings = {
  cashbackPercent: number;
  loyaltyPointsPerCurrency: number;
  loyaltyEnabled: boolean;
  loyaltyProgramName: string;
  loyaltyProgramType: LoyaltyProgramType;
  loyaltyRewardDescription: string;
};

const emptyCoupon = { code: "", description: "", type: "percent" as "percent" | "fixed", value: "", minOrder: "", active: true };

const loyaltyTypeOptions: Array<{ value: LoyaltyProgramType; label: string }> = [
  { value: "points", label: "Somente pontos" },
  { value: "cashback", label: "Somente cashback" },
  { value: "points_cashback", label: "Pontos + cashback" },
  { value: "custom", label: "Personalizado" },
];

export default function Marketing() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: coupons = [] } = useQuery({ queryKey: ["coupons"], queryFn: () => apiRequest<Coupon[]>("/api/marketing/coupons") });
  const { data: settings } = useQuery({ queryKey: ["business-settings"], queryFn: () => apiRequest<BusinessSettings>("/api/settings/business") });
  const [coupon, setCoupon] = useState(emptyCoupon);
  const [loyalty, setLoyalty] = useState({
    enabled: true,
    programName: "Cartão fidelidade",
    programType: "points_cashback" as LoyaltyProgramType,
    rewardDescription: "Acumule pontos e cashback em suas compras.",
    cashback: "0",
    points: "1",
  });

  useEffect(() => {
    if (!settings) return;
    setLoyalty({
      enabled: settings.loyaltyEnabled ?? true,
      programName: settings.loyaltyProgramName || "Cartão fidelidade",
      programType: settings.loyaltyProgramType || "points_cashback",
      rewardDescription: settings.loyaltyRewardDescription || "Acumule pontos e cashback em suas compras.",
      cashback: String(settings.cashbackPercent ?? 0),
      points: String(settings.loyaltyPointsPerCurrency ?? 1),
    });
  }, [settings]);

  const createCoupon = useMutation({
    mutationFn: () => apiRequest<Coupon>("/api/marketing/coupons", {
      method: "POST",
      body: JSON.stringify({ ...coupon, value: Number(coupon.value || 0), minOrder: Number(coupon.minOrder || 0) }),
    }),
    onSuccess: () => {
      setCoupon(emptyCoupon);
      qc.invalidateQueries({ queryKey: ["coupons"] });
      toast({ title: "Cupom criado" });
    },
  });

  const removeCoupon = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/marketing/coupons/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coupons"] }),
  });

  const toggleCoupon = useMutation({
    mutationFn: (item: Coupon) => apiRequest<Coupon>(`/api/marketing/coupons/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !item.active }),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coupons"] }),
  });

  const saveSettings = useMutation({
    mutationFn: () => apiRequest("/api/settings/business", {
      method: "PUT",
      body: JSON.stringify({
        cashbackPercent: Number(loyalty.cashback || 0),
        loyaltyPointsPerCurrency: Number(loyalty.points || 0),
        loyaltyEnabled: loyalty.enabled,
        loyaltyProgramName: loyalty.programName,
        loyaltyProgramType: loyalty.programType,
        loyaltyRewardDescription: loyalty.rewardDescription,
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business-settings"] });
      toast({ title: "Cartão fidelidade salvo" });
    },
  });

  const showPoints = loyalty.programType === "points" || loyalty.programType === "points_cashback" || loyalty.programType === "custom";
  const showCashback = loyalty.programType === "cashback" || loyalty.programType === "points_cashback" || loyalty.programType === "custom";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl font-bold" style={{ color: "#7B2E68" }}>Marketing</h1>
        <p className="text-sm text-muted-foreground">Cupons, cashback e fidelidade.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-lg border bg-white p-4 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <Megaphone className="h-5 w-5" style={{ color: "#7B2E68" }} />
            <h2 className="font-semibold">Cupons</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-5">
            <Input placeholder="CODIGO" value={coupon.code} onChange={(e) => setCoupon({ ...coupon, code: e.target.value.toUpperCase() })} />
            <Input className="sm:col-span-2" placeholder="Descrição" value={coupon.description} onChange={(e) => setCoupon({ ...coupon, description: e.target.value })} />
            <Select value={coupon.type} onValueChange={(type: "percent" | "fixed") => setCoupon({ ...coupon, type })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">%</SelectItem>
                <SelectItem value="fixed">R$</SelectItem>
              </SelectContent>
            </Select>
            <Input type="number" placeholder="Valor" value={coupon.value} onChange={(e) => setCoupon({ ...coupon, value: e.target.value })} />
            <Input placeholder="Pedido mín." type="number" value={coupon.minOrder} onChange={(e) => setCoupon({ ...coupon, minOrder: e.target.value })} />
            <div className="flex items-center gap-2">
              <Switch checked={coupon.active} onCheckedChange={(active) => setCoupon({ ...coupon, active })} />
              <Label>Ativo</Label>
            </div>
            <Button className="gap-2 sm:col-span-2" onClick={() => createCoupon.mutate()} disabled={!coupon.code || createCoupon.isPending} style={{ backgroundColor: "#7B2E68" }}>
              <Plus className="h-4 w-4" /> Criar cupom
            </Button>
          </div>

          <div className="mt-5 grid gap-2">
            {coupons.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold">{item.code}</span>
                    <Badge>{item.active ? "Ativo" : "Inativo"}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.description || "Sem descrição"} - {item.type === "percent" ? `${item.value}%` : item.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => toggleCoupon.mutate(item)}>
                    {item.active ? "Desativar" : "Ativar"}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => removeCoupon.mutate(item.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-1 font-semibold">Cartão fidelidade</h2>
          <p className="mb-4 text-sm text-muted-foreground">Ative, desative e edite o tipo de fidelidade exibido ao cliente na loja.</p>
          <div className="grid gap-4">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>Ativar fidelidade</Label>
                <p className="text-xs text-muted-foreground">Quando desligado, a loja não mostra pontos ou cashback.</p>
              </div>
              <Switch checked={loyalty.enabled} onCheckedChange={(enabled) => setLoyalty({ ...loyalty, enabled })} />
            </div>
            <div>
              <Label>Nome do programa</Label>
              <Input value={loyalty.programName} onChange={(e) => setLoyalty({ ...loyalty, programName: e.target.value })} />
            </div>
            <div>
              <Label>Tipo de fidelidade</Label>
              <Select value={loyalty.programType} onValueChange={(programType: LoyaltyProgramType) => setLoyalty({ ...loyalty, programType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {loyaltyTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {showCashback && (
              <div>
                <Label>Cashback (%)</Label>
                <Input type="number" min="0" max="100" value={loyalty.cashback} onChange={(e) => setLoyalty({ ...loyalty, cashback: e.target.value })} />
              </div>
            )}
            {showPoints && (
              <div>
                <Label>Pontos por R$ 1</Label>
                <Input type="number" min="0" value={loyalty.points} onChange={(e) => setLoyalty({ ...loyalty, points: e.target.value })} />
              </div>
            )}
            <div>
              <Label>Mensagem para o cliente</Label>
              <Input value={loyalty.rewardDescription} onChange={(e) => setLoyalty({ ...loyalty, rewardDescription: e.target.value })} />
            </div>
            <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending || !loyalty.programName.trim()} style={{ backgroundColor: "#7B2E68" }}>
              Salvar fidelidade
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
