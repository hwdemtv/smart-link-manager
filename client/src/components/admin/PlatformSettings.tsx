import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, RefreshCcw } from "lucide-react";

export default function PlatformSettings() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const { data: config, isLoading } = trpc.configs.getConfig.useQuery();
  const updateMutation = trpc.configs.updateRegistrationConfig.useMutation({
    onSuccess: () => {
      toast.success(t("admin.system.saveSuccess"));
      utils.configs.getConfig.invalidate();
    },
    onError: error => {
      toast.error(error.message);
    },
  });

  const [regDisabled, setRegDisabled] = useState(false);
  const [defaultDomain, setDefaultDomain] = useState("");

  const updateDomainMutation =
    trpc.configs.updateDefaultDomainConfig.useMutation({
      onSuccess: () => {
        toast.success("系统默认域名已更新");
        utils.configs.getConfig.invalidate();
      },
      onError: error => {
        toast.error(error.message);
      },
    });

  useEffect(() => {
    if (config) {
      setRegDisabled(config.registrationDisabled);
      setDefaultDomain(config.defaultDomain || "");
    }
  }, [config]);

  const handleToggle = (checked: boolean) => {
    setRegDisabled(!checked); // checked means Enabled, so disabled = !checked
    updateMutation.mutate({ disabled: !checked });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <CardTitle>{t("admin.system.platformControl")}</CardTitle>
          </div>
          <CardDescription>
            {t("admin.system.platformControlDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
            <div className="space-y-0.5">
              <Label className="text-base font-semibold">
                {t("admin.system.allowRegister")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("admin.system.allowRegisterHint")}
              </p>
            </div>
            <Switch
              checked={!regDisabled}
              onCheckedChange={handleToggle}
              disabled={isLoading || updateMutation.isPending}
            />
          </div>

          <div className="flex flex-col gap-3 p-4 border rounded-lg bg-muted/30">
            <div className="space-y-0.5">
              <Label className="text-base font-semibold">
                系统默认生成域名
              </Label>
              <p className="text-sm text-muted-foreground">
                开启此项后，所有前端未指定自有域名的短链接均默认使用该顶级域名进行拼接。留空则退回至当前面板被访问时所用的地址。
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Input
                placeholder="例如：s.example.com"
                value={defaultDomain}
                onChange={e => setDefaultDomain(e.target.value)}
                className="max-w-md font-mono"
              />
              <Button
                variant="secondary"
                disabled={
                  isLoading ||
                  updateDomainMutation.isPending ||
                  (config && defaultDomain === config.defaultDomain)
                }
                onClick={() =>
                  updateDomainMutation.mutate({ domain: defaultDomain })
                }
              >
                {updateDomainMutation.isPending ? "保存中..." : "保存域名"}
              </Button>
            </div>
          </div>

          <div className="p-4 border border-yellow-500/30 rounded-lg bg-yellow-500/5">
            <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
              {t("admin.system.adminNotice")}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.system.maintenance")}</CardTitle>
          <CardDescription>{t("admin.system.maintenanceDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="flex items-center gap-2"
            disabled
          >
            <RefreshCcw className="w-4 h-4" />
            {t("admin.system.clearCache")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
