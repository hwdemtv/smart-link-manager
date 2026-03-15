import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { trpc } from "@/lib/trpc";
import React, { useState, useEffect, ChangeEvent } from "react";
type ChangeEventT<T = Element> = ChangeEvent<T>;
import { toast } from "sonner";
import { Sparkles, Save, Info, Eye, EyeOff, Bot } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function AiSettings() {
  const { t } = useTranslation();
  const [showApiKey, setShowApiKey] = useState(false);
  const [formData, setFormData] = useState({
    provider: "openai",
    baseUrl: "",
    apiKey: "",
    model: "gpt-4o",
    temperature: 0.3,
  });

  const configQuery = (trpc.configs.getAiConfig as any).useQuery();
  const updateConfigMutation = (trpc.configs.updateAiConfig as any).useMutation();

  useEffect(() => {
    if (configQuery.data) {
      setFormData(configQuery.data);
    }
  }, [configQuery.data]);

  const handleSave = async () => {
    try {
      await updateConfigMutation.mutateAsync(formData);
      toast.success("AI 配置已保存");
      configQuery.refetch();
    } catch (error: any) {
      toast.error(error.message || "保存失败");
    }
  };

  const maskApiKey = (key: string) => {
    if (!key) return "";
    if (key.length <= 8) return "********";
    return `${key.slice(0, 4)}****${key.slice(-4)}`;
  };

  return (
    <div className="container py-8 max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">大模型设置</h1>
          <p className="text-muted-foreground mt-2">
            配置用于 AI SEO 智能摘要的大模型参数
          </p>
        </div>
        <Bot className="w-12 h-12 text-accent-blue opacity-20" />
      </div>

      <div className="grid gap-6">
        <Card className="shadow-lg border-accent-blue/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent-blue" />
              API 基础配置
            </CardTitle>
            <CardDescription>
              设置您的模型供应商和连接端点
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="provider">供应商 (Provider)</Label>
                <Input
                  id="provider"
                  value={formData.provider}
                  onChange={(e: ChangeEventT<HTMLInputElement>) => setFormData({ ...formData, provider: e.target.value })}
                  placeholder="openai / deepseek"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">默认模型 (Model)</Label>
                <Input
                  id="model"
                  value={formData.model}
                  onChange={(e: ChangeEventT<HTMLInputElement>) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="gpt-4o / deepseek-chat"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="baseUrl">API 基础地址 (Base URL)</Label>
              <Input
                id="baseUrl"
                value={formData.baseUrl}
                onChange={(e: ChangeEventT<HTMLInputElement>) => setFormData({ ...formData, baseUrl: e.target.value })}
                placeholder="https://api.openai.com/v1"
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" />
                通常以 /v1 结尾
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={showApiKey ? "text" : "password"}
                  value={formData.apiKey}
                  onChange={(e: ChangeEventT<HTMLInputElement>) => setFormData({ ...formData, apiKey: e.target.value })}
                  className="pr-10"
                  placeholder="sk-..."
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-accent-blue/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              分析参数微调
            </CardTitle>
            <CardDescription>
              控制 AI 生成内容的灵活性与创造力
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>温度 (Temperature): {formData.temperature}</Label>
                <span className="text-xs text-muted-foreground">
                  {formData.temperature < 0.3 ? "更专业精准" : formData.temperature > 0.7 ? "更具创造性" : "平衡模式"}
                </span>
              </div>
              <Slider
                value={[formData.temperature]}
                min={0}
                max={1.5}
                step={0.1}
                onValueChange={(val: number[]) => setFormData({ ...formData, temperature: val[0] })}
                className="py-4"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground px-1">
                <span>准确 (0.0)</span>
                <span>创意 (1.5)</span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-accent-blue/5 border-t px-6 py-4">
            <Button onClick={handleSave} className="ml-auto gap-2 bg-primary">
              <Save className="w-4 h-4" />
              保存配置
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
