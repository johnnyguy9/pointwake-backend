import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Building2, Users, Plus, AlertCircle, CheckCircle, Clock, Ban } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Account } from "@shared/schema";

export default function AdminPage() {
  const { isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [showProvisionDialog, setShowProvisionDialog] = useState(false);

  const { data: accounts = [], isLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
    enabled: isSuperAdmin,
  });

  const provisionMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/provision-account", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      setShowProvisionDialog(false);
      toast({ title: "Account provisioned successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to provision account", description: error.message, variant: "destructive" });
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/accounts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      toast({ title: "Account updated" });
    },
  });

  const handleProvision = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    provisionMutation.mutate({
      accountName: formData.get("accountName"),
      tier: formData.get("tier"),
      adminUsername: formData.get("adminUsername"),
      adminPassword: formData.get("adminPassword"),
      adminEmail: formData.get("adminEmail"),
      adminFullName: formData.get("adminFullName"),
    });
  };

  const handleStatusChange = (accountId: string, status: string) => {
    updateAccountMutation.mutate({ id: accountId, data: { status } });
  };

  const handleTierChange = (accountId: string, tier: string) => {
    updateAccountMutation.mutate({ id: accountId, data: { tier, billingPlan: tier } });
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-lg font-semibold">Access Denied</h2>
              <p className="text-muted-foreground mt-1">You don't have permission to view this page.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeAccounts = accounts.filter(a => a.status === "active").length;
  const trialAccounts = accounts.filter(a => a.status === "trial").length;
  const suspendedAccounts = accounts.filter(a => a.status === "suspended").length;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "trial":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "suspended":
        return <Ban className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getTierBadgeVariant = (tier: string) => {
    switch (tier) {
      case "enterprise":
        return "default";
      case "professional":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Super Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage all accounts and system settings</p>
        </div>
        <Dialog open={showProvisionDialog} onOpenChange={setShowProvisionDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-provision-account">
              <Plus className="h-4 w-4 mr-2" />
              Provision Account
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <form onSubmit={handleProvision}>
              <DialogHeader>
                <DialogTitle>Provision New Account</DialogTitle>
                <DialogDescription>Create a new tenant account with an admin user</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="accountName">Account Name</Label>
                  <Input id="accountName" name="accountName" placeholder="Company Name" required data-testid="input-account-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tier">Tier</Label>
                  <Select name="tier" defaultValue="professional">
                    <SelectTrigger data-testid="select-tier">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-3">Admin User Details</p>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="adminFullName">Full Name</Label>
                      <Input id="adminFullName" name="adminFullName" required data-testid="input-admin-fullname" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="adminUsername">Username</Label>
                      <Input id="adminUsername" name="adminUsername" required data-testid="input-admin-username" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="adminEmail">Email</Label>
                      <Input id="adminEmail" name="adminEmail" type="email" data-testid="input-admin-email" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="adminPassword">Password</Label>
                      <Input id="adminPassword" name="adminPassword" type="password" required data-testid="input-admin-password" />
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={provisionMutation.isPending} data-testid="button-submit-provision">
                  {provisionMutation.isPending ? "Provisioning..." : "Provision Account"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Accounts</CardDescription>
            <CardTitle className="text-3xl" data-testid="text-total-accounts">{accounts.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-3xl text-green-600" data-testid="text-active-accounts">{activeAccounts}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Trial</CardDescription>
            <CardTitle className="text-3xl text-yellow-600" data-testid="text-trial-accounts">{trialAccounts}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Suspended</CardDescription>
            <CardTitle className="text-3xl text-red-600" data-testid="text-suspended-accounts">{suspendedAccounts}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="accounts" className="space-y-6">
        <TabsList>
          <TabsTrigger value="accounts" data-testid="tab-accounts">
            <Building2 className="h-4 w-4 mr-2" />
            Accounts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounts">
          <Card>
            <CardHeader>
              <CardTitle>All Accounts</CardTitle>
              <CardDescription>Manage tenant accounts</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground">Loading accounts...</p>
              ) : (
                <div className="space-y-3">
                  {accounts.map((account) => (
                    <div key={account.id} className="flex items-center justify-between gap-4 p-4 rounded-md border" data-testid={`account-row-${account.id}`}>
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center">
                          <Building2 className="h-6 w-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{account.name}</p>
                            {getStatusIcon(account.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {account.mainPhoneNumber || "No phone"} | Created: {account.createdAt ? new Date(account.createdAt).toLocaleDateString() : "N/A"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={getTierBadgeVariant(account.tier)}>{account.tier}</Badge>
                        <Select value={account.status} onValueChange={(value) => handleStatusChange(account.id, value)}>
                          <SelectTrigger className="w-32" data-testid={`select-status-${account.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="trial">Trial</SelectItem>
                            <SelectItem value="suspended">Suspended</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={account.tier} onValueChange={(value) => handleTierChange(account.id, value)}>
                          <SelectTrigger className="w-32" data-testid={`select-tier-${account.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">Free</SelectItem>
                            <SelectItem value="professional">Professional</SelectItem>
                            <SelectItem value="enterprise">Enterprise</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
