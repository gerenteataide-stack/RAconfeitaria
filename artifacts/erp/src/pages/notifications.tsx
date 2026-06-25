import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, Send } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type Notification = {
  id: number;
  audience: "admin" | "customer";
  channel: "system" | "whatsapp" | "email" | "push";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export default function Notifications() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: notifications = [] } = useQuery({ queryKey: ["notifications"], queryFn: () => apiRequest<Notification[]>("/api/notifications") });
  const [form, setForm] = useState({ audience: "admin", channel: "system", title: "", message: "" });

  const create = useMutation({
    mutationFn: () => apiRequest<Notification>("/api/notifications", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: () => {
      setForm({ audience: "admin", channel: "system", title: "", message: "" });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast({ title: "Notificação registrada" });
    },
  });

  const markRead = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-serif font-bold" style={{ color: "#7B2E68" }}>Notificações</h1>
        <p className="text-sm text-muted-foreground">Fila interna para WhatsApp, email, push e avisos administrativos.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 font-semibold"><Send className="h-4 w-4" /> Nova mensagem</h2>
          <div className="grid gap-3">
            <div>
              <Label>Público</Label>
              <Select value={form.audience} onValueChange={(audience) => setForm({ ...form, audience })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administração</SelectItem>
                  <SelectItem value="customer">Cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Canal</Label>
              <Select value={form.channel} onValueChange={(channel) => setForm({ ...form, channel })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">Sistema</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="push">Push</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Mensagem</Label><Textarea rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
            <Button onClick={() => create.mutate()} disabled={!form.title || !form.message || create.isPending} style={{ backgroundColor: "#7B2E68" }}>Registrar</Button>
          </div>
        </section>

        <section className="grid gap-3 lg:col-span-2">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-white p-10 text-muted-foreground">
              <Bell className="mb-3 h-8 w-8" />
              <p>Nenhuma notificação registrada.</p>
            </div>
          ) : notifications.map((item) => (
            <div key={item.id} className="flex items-start justify-between rounded-lg border bg-white p-4 shadow-sm">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <h2 className="font-semibold">{item.title}</h2>
                  <Badge variant={item.read ? "secondary" : "default"}>{item.read ? "Lida" : "Nova"}</Badge>
                  <Badge variant="outline">{item.channel}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{item.message}</p>
                <p className="mt-2 text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString("pt-BR")} · {item.audience === "admin" ? "Administração" : "Cliente"}</p>
              </div>
              {!item.read && <Button variant="ghost" size="icon" onClick={() => markRead.mutate(item.id)}><Check className="h-4 w-4" /></Button>}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
