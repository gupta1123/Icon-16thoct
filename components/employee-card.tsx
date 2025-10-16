import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock } from "lucide-react";
import { format } from "date-fns";
import { Heading, Text } from "@/components/ui/typography";

interface Employee {
  id: number;
  name: string;
  position: string;
  avatar: string;
  lastUpdated: string;
  status: string;
  location: string;
  totalVisits?: number;
}

interface EmployeeCardProps {
  employee: Employee;
  onClick: () => void;
  hideState?: boolean;
}

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
};

export default function EmployeeCard({ employee, onClick, hideState = false }: EmployeeCardProps) {
  const displayLocation = hideState 
    ? employee.location.split(',')[0].trim() 
    : employee.location;

  return (
    <Card 
      className="group cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all duration-200 h-full"
      onClick={onClick}
    >
      <CardContent className="p-4 h-full flex flex-col">
        {/* Header Row - Avatar + Name + Status */}
        <div className="flex items-center gap-3 mb-3">
          <div className="relative h-12 w-12 rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center font-semibold text-sm shadow-sm group-hover:shadow-md transition-shadow shrink-0">
            {getInitials(employee.name)}
            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-green-500" />
          </div>
          
          <div className="flex-1 min-w-0">
            <Heading as="h3" size="md" weight="semibold" className="truncate group-hover:text-primary transition-colors">
              {employee.name}
            </Heading>
            <Text size="sm" tone="muted" className="truncate capitalize">
              {employee.position}
            </Text>
          </div>
          
          <Badge variant="secondary" className="text-xs capitalize shrink-0">
            {employee.status}
          </Badge>
        </div>
        
        {/* Info Grid - Location and Time */}
        <div className="grid grid-cols-2 gap-3 flex-1">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <Text size="xs" tone="muted" className="font-medium">Location</Text>
              <Text size="sm" className="truncate">{displayLocation}</Text>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <Text size="xs" tone="muted" className="font-medium">Last Updated</Text>
              <Text size="sm" className="truncate">
                {format(new Date(employee.lastUpdated), "h:mm a")}
              </Text>
            </div>
          </div>
        </div>
        
        {/* Footer - Visits Count */}
        {employee.totalVisits !== undefined && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center justify-between">
              <Text size="xs" tone="muted" className="font-medium">Total Visits</Text>
              <Badge variant="outline" className="text-xs font-medium">
                {employee.totalVisits}
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
