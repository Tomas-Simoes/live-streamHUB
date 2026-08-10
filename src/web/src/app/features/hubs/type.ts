type HubCard = {
    name: string;
    category: string;
    description: string;
    features: string[];
    status: string;
};

type HubEntry = {
    hub: Hub;
    index: number;
    card: HubCard;
};