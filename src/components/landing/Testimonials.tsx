import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Michael R.",
    role: "Investor since 2023",
    content: "CryptoVest has completely changed how I approach crypto investing. The bi-weekly returns are consistent and the platform is incredibly easy to use.",
    rating: 5,
    avatar: "MR",
  },
  {
    name: "Sarah K.",
    role: "Investor since 2024",
    content: "I was skeptical at first, but after my first withdrawal, I knew this was legitimate. The support team is responsive and the earnings are real.",
    rating: 5,
    avatar: "SK",
  },
  {
    name: "James O.",
    role: "Investor since 2023",
    content: "The referral program is amazing. I've been able to grow my network and earn additional income while helping others discover this opportunity.",
    rating: 5,
    avatar: "JO",
  },
];

export const Testimonials = () => {
  return (
    <section className="py-20 px-4 bg-card/50">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            What Our <span className="text-primary">Investors</span> Say
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Join thousands of satisfied investors who are growing their wealth with CryptoVest.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-background/80 backdrop-blur-sm border border-border/50 rounded-xl p-6 hover:border-primary/50 transition-all duration-300"
            >
              <div className="flex gap-1 mb-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                ))}
              </div>
              
              <p className="text-muted-foreground mb-6 leading-relaxed">
                "{testimonial.content}"
              </p>
              
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
                  {testimonial.avatar}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{testimonial.name}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
