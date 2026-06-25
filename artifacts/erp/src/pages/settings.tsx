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
  pixKey: string;
  privacyPolicyUrl: string;
  businessName: string;
  businessSubtitle: string;
  businessDescription: string;
  instagram: string;
  location: string;
  serviceNote: string;
};

const empty = {
  businessName: "",
  businessSubtitle: "",
  businessDescription: "",
  whatsappNumber: "",
  pixKey: "",
  instagram: "",
  location: "",
  serviceNote: "",
  privacyPolicyUrl: "",
};

export default function Settings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["business-settings"],
    queryFn: () => apiRequest<BusinessSettings>("/api/settings/business"),
  });
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (data) {
      setForm({
        businessName: data.businessName ?? "",
        businessSubtitle: data.businessSubtitle ?? "",
        businessDescription: data.businessDescription ?? "",
        whatsappNumber: data.whatsappNumber ?? "",
        pixKey: data.pixKey ?? "",
        instagram: data.instagram ?? "",
        location: data.location ?? "",
        serviceNote: data.serviceNote ?? "",
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
      qc.invalidateQueries({ queryKey: ["public-settings"] });
      toast({ title: "Configurações salvas" });
    },
  });

  function setField(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl font-bold" style={{ color: "#7B2E68" }}>Configurações</h1>
        <p className="text-sm text-muted-foreground">Preferências comerciais, contato, pagamento e LGPD.</p>
      </div>

      <section className="rounded-lg border bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" style={{ color: "#7B2E68" }} />
          <h2 className="font-semibold">Informações da loja</h2>
        </div>
        <div className="grid gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Nome da marca</Label>
              <Input value={form.businessName} onChange={(event) => setField("businessName", event.target.value)} />
            </div>
            <div>
              <Label>Subtítulo</Label>
              <Input value={form.businessSubtitle} onChange={(event) => setField("businessSubtitle", event.target.value)} />
            </div>
          </div>
          <div>
            <Label>Descrição da loja</Label>
            <Input value={form.businessDescription} onChange={(event) => setField("businessDescription", event.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>WhatsApp oficial</Label>
              <Input placeholder="(11) 99999-9999" value={form.whatsappNumber} onChange={(event) => setField("whatsappNumber", event.target.value)} />
            </div>
            <div>
              <Label>Chave Pix</Label>
              <Input placeholder="CPF, CNPJ, email, telefone ou chave aleatória" value={form.pixKey} onChange={(event) => setField("pixKey", event.target.value)} />
            </div>
          </div>
          <div>
            <Label>Instagram</Label>
            <Input placeholder="@usuario" value={form.instagram} onChange={(event) => setField("instagram", event.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Localização</Label>
              <Input value={form.location} onChange={(event) => setField("location", event.target.value)} />
            </div>
            <div>
              <Label>Observação de atendimento</Label>
              <Input value={form.serviceNote} onChange={(event) => setField("serviceNote", event.target.value)} />
            </div>
          </div>
          <div>
            <Label>URL da política de privacidade</Label>
            <Input placeholder="https://..." value={form.privacyPolicyUrl} onChange={(event) => setField("privacyPolicyUrl", event.target.value)} />
          </div>
          <Button className="w-fit" onClick={() => save.mutate()} disabled={save.isPending} style={{ backgroundColor: "#7B2E68" }}>
            {save.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </section>
    </div>
  );
}
