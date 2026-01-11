import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Settings, User, Bell, Shield, Building2, Phone, Bot, Users, Store, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User as UserType, Property, Vendor } from "@shared/schema";

export default function SettingsPage() {
  const { user, isAccountAdmin } = useAuth();
  const { toast } = useToast();
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showPropertyDialog, setShowPropertyDialog] = useState(false);
  const [showVendorDialog, setShowVendorDialog] = useState(false);

  const { data: users = [], isLoading: usersLoading } = useQuery<any[]>({
    queryKey: ["/api/users"],
    enabled: isAccountAdmin,
  });

  const { data: properties = [], isLoading: propertiesLoading } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
    enabled: isAccountAdmin,
  });

  const { data: vendors = [], isLoading: vendorsLoading } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
    enabled: isAccountAdmin,
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/users", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setShowUserDialog(false);
      toast({ title: "User created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create user", description: error.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User deleted successfully" });
    },
  });

  const createPropertyMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/properties", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      setShowPropertyDialog(false);
      toast({ title: "Property created successfully" });
    },
  });

  const deletePropertyMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/properties/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      toast({ title: "Property deleted successfully" });
    },
  });

  const createVendorMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/vendors", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      setShowVendorDialog(false);
      toast({ title: "Vendor created successfully" });
    },
  });

  const deleteVendorMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/vendors/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      toast({ title: "Vendor deleted successfully" });
    },
  });

  const handleCreateUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createUserMutation.mutate({
      username: formData.get("username"),
      password: formData.get("password"),
      name: formData.get("name"),
      fullName: formData.get("name"),
      email: formData.get("email"),
      role: formData.get("role"),
      phoneNumber: formData.get("phone"),
    });
  };

  const handleCreateProperty = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createPropertyMutation.mutate({
      name: formData.get("name"),
      address: formData.get("address"),
      primaryPhone: formData.get("phone"),
    });
  };

  const handleCreateVendor = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createVendorMutation.mutate({
      name: formData.get("name"),
      trade: formData.get("trade"),
      contactPhone: formData.get("phone"),
      contactEmail: formData.get("email"),
      afterHoursAvailable: formData.get("afterHours") === "on",
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile" className="gap-2" data-testid="tab-profile">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2" data-testid="tab-notifications">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2" data-testid="tab-ai">
            <Bot className="h-4 w-4" />
            AI Settings
          </TabsTrigger>
          {isAccountAdmin && (
            <>
              <TabsTrigger value="users" className="gap-2" data-testid="tab-users">
                <Users className="h-4 w-4" />
                Users
              </TabsTrigger>
              <TabsTrigger value="properties" className="gap-2" data-testid="tab-properties">
                <Building2 className="h-4 w-4" />
                Properties
              </TabsTrigger>
              <TabsTrigger value="vendors" className="gap-2" data-testid="tab-vendors">
                <Store className="h-4 w-4" />
                Vendors
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" defaultValue={user?.name || ""} data-testid="input-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" defaultValue={user?.username || ""} disabled data-testid="input-username" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" defaultValue={user?.email || ""} data-testid="input-email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" type="tel" defaultValue={user?.phoneNumber || ""} data-testid="input-phone" />
                </div>
              </div>
              <Button data-testid="button-save-profile">Save Changes</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>Manage your password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input id="current-password" type="password" data-testid="input-current-password" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input id="new-password" type="password" data-testid="input-new-password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input id="confirm-password" type="password" data-testid="input-confirm-password" />
                </div>
              </div>
              <Button variant="outline" data-testid="button-change-password">Change Password</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Choose how you want to be notified</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Incoming Call Alerts</Label>
                  <p className="text-sm text-muted-foreground">Get notified when a new call comes in</p>
                </div>
                <Switch defaultChecked data-testid="switch-call-alerts" />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>New Incident Notifications</Label>
                  <p className="text-sm text-muted-foreground">Get notified when a new incident is created</p>
                </div>
                <Switch defaultChecked data-testid="switch-incident-alerts" />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Escalation Alerts</Label>
                  <p className="text-sm text-muted-foreground">Get notified when an incident is escalated</p>
                </div>
                <Switch defaultChecked data-testid="switch-escalation-alerts" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Operator Settings</CardTitle>
              <CardDescription>Configure AI behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>AI Auto-Answer</Label>
                  <p className="text-sm text-muted-foreground">Let AI answer calls automatically</p>
                </div>
                <Switch defaultChecked data-testid="switch-ai-auto-answer" />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>AI Emergency Detection</Label>
                  <p className="text-sm text-muted-foreground">Automatically detect and escalate emergencies</p>
                </div>
                <Switch defaultChecked data-testid="switch-ai-emergency" />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-Dispatch</Label>
                  <p className="text-sm text-muted-foreground">Allow AI to dispatch vendors automatically</p>
                </div>
                <Switch data-testid="switch-ai-dispatch" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isAccountAdmin && (
          <>
            <TabsContent value="users" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <CardTitle>Team Members</CardTitle>
                      <CardDescription>Manage users in your organization</CardDescription>
                    </div>
                    <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
                      <DialogTrigger asChild>
                        <Button data-testid="button-add-user">
                          <Plus className="h-4 w-4 mr-2" />
                          Add User
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <form onSubmit={handleCreateUser}>
                          <DialogHeader>
                            <DialogTitle>Add New User</DialogTitle>
                            <DialogDescription>Create a new team member account</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="new-user-name">Full Name</Label>
                              <Input id="new-user-name" name="name" required data-testid="input-new-user-name" />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="new-user-username">Username</Label>
                              <Input id="new-user-username" name="username" required data-testid="input-new-user-username" />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="new-user-email">Email</Label>
                              <Input id="new-user-email" name="email" type="email" data-testid="input-new-user-email" />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="new-user-password">Password</Label>
                              <Input id="new-user-password" name="password" type="password" required data-testid="input-new-user-password" />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="new-user-phone">Phone</Label>
                              <Input id="new-user-phone" name="phone" type="tel" data-testid="input-new-user-phone" />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="new-user-role">Role</Label>
                              <Select name="role" defaultValue="staff">
                                <SelectTrigger data-testid="select-new-user-role">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="account_admin">Account Admin</SelectItem>
                                  <SelectItem value="manager">Manager</SelectItem>
                                  <SelectItem value="staff">Staff</SelectItem>
                                  <SelectItem value="viewer">Viewer</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button type="submit" disabled={createUserMutation.isPending} data-testid="button-submit-user">
                              {createUserMutation.isPending ? "Creating..." : "Create User"}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {usersLoading ? (
                    <p className="text-muted-foreground">Loading users...</p>
                  ) : (
                    <div className="space-y-3">
                      {users.map((u: any) => (
                        <div key={u.id} className="flex items-center justify-between gap-4 p-3 rounded-md border" data-testid={`user-row-${u.id}`}>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                              <User className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-medium">{u.name}</p>
                              <p className="text-sm text-muted-foreground">{u.username} - {u.email || "No email"}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{u.role}</Badge>
                            {u.id !== user?.id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteUserMutation.mutate(u.id)}
                                data-testid={`button-delete-user-${u.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="properties" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <CardTitle>Properties</CardTitle>
                      <CardDescription>Manage properties in your account</CardDescription>
                    </div>
                    <Dialog open={showPropertyDialog} onOpenChange={setShowPropertyDialog}>
                      <DialogTrigger asChild>
                        <Button data-testid="button-add-property">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Property
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <form onSubmit={handleCreateProperty}>
                          <DialogHeader>
                            <DialogTitle>Add New Property</DialogTitle>
                            <DialogDescription>Add a new property to your account</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="property-name">Property Name</Label>
                              <Input id="property-name" name="name" required data-testid="input-property-name" />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="property-address">Address</Label>
                              <Input id="property-address" name="address" required data-testid="input-property-address" />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="property-phone">Phone</Label>
                              <Input id="property-phone" name="phone" type="tel" data-testid="input-property-phone" />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button type="submit" disabled={createPropertyMutation.isPending} data-testid="button-submit-property">
                              {createPropertyMutation.isPending ? "Creating..." : "Add Property"}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {propertiesLoading ? (
                    <p className="text-muted-foreground">Loading properties...</p>
                  ) : (
                    <div className="space-y-3">
                      {properties.map((property: Property) => (
                        <div key={property.id} className="flex items-center justify-between gap-4 p-3 rounded-md border" data-testid={`property-row-${property.id}`}>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                              <Building2 className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-medium">{property.name}</p>
                              <p className="text-sm text-muted-foreground">{property.address}</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deletePropertyMutation.mutate(property.id)}
                            data-testid={`button-delete-property-${property.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="vendors" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <CardTitle>Vendors</CardTitle>
                      <CardDescription>Manage service vendors</CardDescription>
                    </div>
                    <Dialog open={showVendorDialog} onOpenChange={setShowVendorDialog}>
                      <DialogTrigger asChild>
                        <Button data-testid="button-add-vendor">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Vendor
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <form onSubmit={handleCreateVendor}>
                          <DialogHeader>
                            <DialogTitle>Add New Vendor</DialogTitle>
                            <DialogDescription>Add a service vendor</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="vendor-name">Vendor Name</Label>
                              <Input id="vendor-name" name="name" required data-testid="input-vendor-name" />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="vendor-trade">Trade</Label>
                              <Select name="trade" defaultValue="general">
                                <SelectTrigger data-testid="select-vendor-trade">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="hvac">HVAC</SelectItem>
                                  <SelectItem value="plumbing">Plumbing</SelectItem>
                                  <SelectItem value="electrical">Electrical</SelectItem>
                                  <SelectItem value="appliance">Appliance</SelectItem>
                                  <SelectItem value="general">General</SelectItem>
                                  <SelectItem value="locksmith">Locksmith</SelectItem>
                                  <SelectItem value="pest_control">Pest Control</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="vendor-phone">Phone</Label>
                              <Input id="vendor-phone" name="phone" type="tel" data-testid="input-vendor-phone" />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="vendor-email">Email</Label>
                              <Input id="vendor-email" name="email" type="email" data-testid="input-vendor-email" />
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch id="afterHours" name="afterHours" data-testid="switch-vendor-after-hours" />
                              <Label htmlFor="afterHours">Available After Hours</Label>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button type="submit" disabled={createVendorMutation.isPending} data-testid="button-submit-vendor">
                              {createVendorMutation.isPending ? "Creating..." : "Add Vendor"}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {vendorsLoading ? (
                    <p className="text-muted-foreground">Loading vendors...</p>
                  ) : (
                    <div className="space-y-3">
                      {vendors.map((vendor: Vendor) => (
                        <div key={vendor.id} className="flex items-center justify-between gap-4 p-3 rounded-md border" data-testid={`vendor-row-${vendor.id}`}>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                              <Store className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-medium">{vendor.name}</p>
                              <p className="text-sm text-muted-foreground">{vendor.trade} - {vendor.contactPhone || "No phone"}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {vendor.afterHoursAvailable && (
                              <Badge variant="secondary">24/7</Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteVendorMutation.mutate(vendor.id)}
                              data-testid={`button-delete-vendor-${vendor.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
