import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, User, ShieldCheck, KeyRound } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function ProfileSettings() {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();

  // Basic Info State
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");

  // Password State
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const updateProfileMutation = trpc.user.updateProfile.useMutation({
    onSuccess: () => {
      toast.success(t("profile.updateSuccess"));
      refresh();
    },
    onError: error => {
      toast.error(error.message);
    },
  });

  const changePasswordMutation = trpc.user.changePassword.useMutation({
    onSuccess: () => {
      toast.success(t("profile.passwordSuccess"));
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: error => {
      if (error.message.includes("Incorrect current password")) {
        toast.error(t("profile.wrongPassword"));
      } else {
        toast.error(error.message);
      }
    },
  });

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate({ name, email });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(t("profile.passwordMismatch"));
      return;
    }
    changePasswordMutation.mutate({ oldPassword, newPassword });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          {t("profile.title")}
        </h1>
        <p className="text-muted-foreground">{t("profile.subtitle")}</p>
      </div>

      <div className="grid gap-8">
        {/* Basic Information */}
        <Card className="shadow-sm border-muted/40">
          <CardHeader>
            <div className="flex items-center gap-2 mb-1">
              <User className="w-5 h-5 text-accent-blue" />
              <CardTitle className="text-xl">
                {t("profile.basicInfo")}
              </CardTitle>
            </div>
            <CardDescription>管理您的账户显示名称和联系邮箱</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name">{t("profile.name")}</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={t("profile.namePlaceholder")}
                  className="max-w-md"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">{t("profile.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t("profile.emailPlaceholder")}
                  className="max-w-md"
                />
              </div>
              <Button
                type="submit"
                disabled={updateProfileMutation.isPending}
                className="bg-accent-blue hover:bg-accent-blue/90"
              >
                {updateProfileMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {t("profile.saveChanges")}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Security / Password */}
        <Card className="shadow-sm border-muted/40">
          <CardHeader>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-accent-blue" />
              <CardTitle className="text-xl">{t("profile.security")}</CardTitle>
            </div>
            <CardDescription>{t("profile.changePasswordDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-6">
              <div className="grid gap-4 max-w-md">
                <div className="grid gap-2">
                  <Label htmlFor="oldPassword">
                    {t("profile.oldPassword")}
                  </Label>
                  <Input
                    id="oldPassword"
                    type="password"
                    value={oldPassword}
                    onChange={e => setOldPassword(e.target.value)}
                    placeholder={t("profile.oldPasswordPlaceholder")}
                    required
                  />
                </div>

                <Separator className="my-2" />

                <div className="grid gap-2">
                  <Label htmlFor="newPassword">
                    {t("profile.newPassword")}
                  </Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder={t("profile.newPasswordPlaceholder")}
                      required
                    />
                    <KeyRound className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground/40" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirmPassword">
                    {t("profile.confirmPassword")}
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder={t("profile.confirmPasswordPlaceholder")}
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="outline"
                disabled={changePasswordMutation.isPending}
                className="border-accent-blue text-accent-blue hover:bg-accent-blue/5"
              >
                {changePasswordMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {t("profile.changePassword")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
