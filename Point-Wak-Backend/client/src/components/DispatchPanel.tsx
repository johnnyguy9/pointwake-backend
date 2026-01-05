import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Phone, MessageSquare, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Vendor, Incident } from "@shared/schema";

interface DispatchPanelProps {
  incident: Incident;
  onDispatchSuccess?: () => void;
}

export function DispatchPanel({ incident, onDispatchSuccess }: DispatchPanelProps) {
  const { toast } = useToast();
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [customMessage, setCustomMessage] = useState<string>("");

  const { data: vendors = [], isLoading: vendorsLoading } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const filteredVendors = incident.trade 
    ? vendors.filter(v => v.trade === incident.trade)
    : vendors;

  const dispatchMutation = useMutation({
    mutationFn: async ({ vendorId, method }: { vendorId: string; method: string }) => {
      const res = await apiRequest("POST", "/api/dispatch", {
        incidentId: incident.id,
        vendorId,
        method,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Dispatch sent successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/incidents", incident.id] });
      onDispatchSuccess?.();
    },
    onError: (error: any) => {
      toast({ title: "Dispatch failed", description: error.message, variant: "destructive" });
    },
  });

  const sendSmsMutation = useMutation({
    mutationFn: async () => {
      const vendor = vendors.find(v => v.id === selectedVendorId);
      if (!vendor) throw new Error("Vendor not found");
      
      const message = customMessage || getDefaultMessage(vendor);
      const res = await apiRequest("POST", "/api/dispatch/sms", {
        vendorId: selectedVendorId,
        incidentId: incident.id,
        message,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "SMS sent successfully" });
      setCustomMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/incidents", incident.id] });
      onDispatchSuccess?.();
    },
    onError: (error: any) => {
      toast({ title: "SMS failed", description: error.message, variant: "destructive" });
    },
  });

  const getDefaultMessage = (vendor: Vendor) => {
    return `PointWake Dispatch: New ${incident.trade || "service"} request at ${incident.summary || "property"}. Severity: ${incident.severity}. Please respond with ETA or call back. Incident #${incident.id.slice(-6)}`;
  };

  const handleDispatch = (method: "sms" | "call") => {
    if (!selectedVendorId) {
      toast({ title: "Please select a vendor", variant: "destructive" });
      return;
    }

    if (method === "sms") {
      sendSmsMutation.mutate();
    } else {
      dispatchMutation.mutate({ vendorId: selectedVendorId, method: "call" });
    }
  };

  const selectedVendor = vendors.find(v => v.id === selectedVendorId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dispatch Vendor</CardTitle>
        <CardDescription>
          Send SMS or initiate call to dispatch a vendor for this incident
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Select Vendor</Label>
          <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
            <SelectTrigger data-testid="select-dispatch-vendor">
              <SelectValue placeholder={vendorsLoading ? "Loading..." : "Choose a vendor"} />
            </SelectTrigger>
            <SelectContent>
              {filteredVendors.map((vendor) => (
                <SelectItem key={vendor.id} value={vendor.id}>
                  <div className="flex items-center gap-2">
                    <span>{vendor.name}</span>
                    <span className="text-muted-foreground text-xs">({vendor.trade})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedVendor && (
          <div className="p-3 rounded-md bg-muted/50 text-sm">
            <p className="font-medium">{selectedVendor.name}</p>
            <p className="text-muted-foreground">
              {selectedVendor.contactPhone || "No phone"} | {selectedVendor.contactEmail || "No email"}
            </p>
            {selectedVendor.afterHoursAvailable && (
              <p className="text-green-600 mt-1">Available 24/7</p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label>Custom Message (Optional)</Label>
          <Textarea
            placeholder={selectedVendor ? getDefaultMessage(selectedVendor) : "Enter custom dispatch message..."}
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            className="min-h-[80px]"
            data-testid="textarea-dispatch-message"
          />
        </div>

        <div className="flex gap-2">
          <Button
            variant="default"
            className="flex-1"
            disabled={!selectedVendorId || sendSmsMutation.isPending}
            onClick={() => handleDispatch("sms")}
            data-testid="button-dispatch-sms"
          >
            {sendSmsMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <MessageSquare className="h-4 w-4 mr-2" />
            )}
            Send SMS
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            disabled={!selectedVendorId || dispatchMutation.isPending}
            onClick={() => handleDispatch("call")}
            data-testid="button-dispatch-call"
          >
            {dispatchMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Phone className="h-4 w-4 mr-2" />
            )}
            Call Vendor
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
