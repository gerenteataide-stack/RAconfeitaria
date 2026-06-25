import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type BusinessSettings = {
  cashbackPercent: number;
  loyaltyPointsPerCurrency: number;
  whatsappNumber: string;
  privacyPolicyUrl: string;
};

export default function Settings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["business-settings"],
    queryFn: () => apiRequest<BusinessSettings>("/api/settings/business"),
  });
  const [form, setForm] = useState({ whatsappNumber: "", privacyPolicyUrl: "" });

  useEffect(() => {
    if (data) {
      setForm({
        whatsappNumber: data.whatsappNumber ?? "",
        privacyPolicyUrl: data.privacyPolicyUrl ?? "",
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => apiRequest("/api/settings/business", {
      method: "PUT",
      body: JSON.stringify(form),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business-settings"] });
      toast({ title: "Configurações salvas" });
    },
  });

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-serif font-bold" style={{ color: "#7B2E68" }}>Configurações</h1>
        <p className="text-sm text-muted-foreground">Preferências comerciais, contato e LGPD.</p>
      </div>

      <section className="rounded-lg border bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" style={{ color: "#7B2E68" }} />
          <h2 className="font-semibold">Contato e privacidade</h2>
        </div>
        <div className="grid gap-4">
          <div>
            <Label>WhatsApp oficial</Label>
            <Input placeholder="5599999999999" value={form.whatsappNumber} onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })} />
          </div>
          <div>
            <Label>URL da política de privacidade</Label>
            <Input placeholder="https://..." value={form.privacyPolicyUrl} onChange={(e) => setForm({ ...form, privacyPolicyUrl: e.target.value })} />
          </div>
          <Button className="w-fit" onClick={() => save.mutate()} style={{ backgroundColor: "#7B2E68" }}>Salvar</Button>
        </div>
      </section>
    </div>
  );
}
