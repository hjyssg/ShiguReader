import { LucideIcon } from "lucide-react"

interface HomeCardProps {
    icon: LucideIcon
    title: string
    subtitle?: string
}

export function HomeCard({ icon: Icon, title, subtitle }: HomeCardProps) {
    return (
        <article className="home-card">
            <Icon className="home-card__icon" />
            <div className="home-card__content">
                <div className="home-card__title" title={title}>{title}</div>
                {subtitle && <div className="home-card__subtitle" title={subtitle}>{subtitle}</div>}
            </div>
        </article>
    )
}
