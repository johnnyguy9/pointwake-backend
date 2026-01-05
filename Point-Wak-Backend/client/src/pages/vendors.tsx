import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Search, Plus, Phone, Mail, Clock, Star, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { Vendor } from "@shared/schema";

const tradeOptions = [
  { value: "all", label: "All Trades" },
  { value: "hvac", label: "HVAC" },
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "appliance", label: "Appliance" },
  { value: "roofing", label: "Roofing" },
  { value: "general", label: "General" },
  { value: "locksmith", label: "Locksmith" },
  { value: "pest_control", label: "Pest Control" },
];

export default function VendorsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [tradeFilter, setTradeFilter] = useState<string>("all");
  const [afterHoursOnly, setAfterHoursOnly] = useState(false);

  const { data: vendors = [], isLoading } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const filteredVendors = vendors.filter((vendor) => {
    const matchesSearch = vendor.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTrade = tradeFilter === "all" || vendor.trade === tradeFilter;
    const matchesAfterHours = !afterHoursOnly || vendor.afterHoursAvailable;
    return matchesSearch && matchesTrade && matchesAfterHours;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Vendors</h1>
          <p className="text-muted-foreground mt-1">Manage your service providers</p>
        </div>
        <Button className="gap-2" data-testid="button-add-vendor">
          <Plus className="h-4 w-4" />
          Add Vendor
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search vendors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-vendors"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={tradeFilter} onValueChange={setTradeFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-trade-filter">
              <SelectValue placeholder="Trade" />
            </SelectTrigger>
            <SelectContent>
              {tradeOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 px-3 rounded-md border bg-background">
            <Switch
              id="after-hours"
              checked={afterHoursOnly}
              onCheckedChange={setAfterHoursOnly}
              data-testid="switch-after-hours"
            />
            <Label htmlFor="after-hours" className="text-sm cursor-pointer">
              After Hours
            </Label>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-5 w-3/4 mb-1" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredVendors.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No vendors found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchQuery || tradeFilter !== "all" || afterHoursOnly
                  ? "Try adjusting your filters"
                  : "Add your first vendor to get started"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredVendors.map((vendor) => (
            <Card key={vendor.id} className="hover-elevate cursor-pointer" data-testid={`card-vendor-${vendor.id}`}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="h-10 w-10 rounded-full bg-chart-3/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-chart-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{vendor.name}</h3>
                      {vendor.priorityRank === 1 && (
                        <Star className="h-4 w-4 text-chart-4 fill-chart-4" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground capitalize">{vendor.trade}</p>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  {vendor.contactPhone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      <span className="font-mono">{vendor.contactPhone}</span>
                    </div>
                  )}
                  {vendor.contactEmail && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      <span className="truncate">{vendor.contactEmail}</span>
                    </div>
                  )}
                  {vendor.coverageAreas && vendor.coverageAreas.length > 0 && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="truncate">{vendor.coverageAreas.join(", ")}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-4">
                  <Badge variant="outline" size="sm" className="capitalize">
                    {vendor.trade}
                  </Badge>
                  {vendor.afterHoursAvailable && (
                    <Badge variant="secondary" size="sm" className="gap-1">
                      <Clock className="h-3 w-3" />
                      24/7
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
