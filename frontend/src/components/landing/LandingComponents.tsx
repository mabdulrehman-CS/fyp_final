import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Brain, Code, MessageSquare } from 'lucide-react';

export function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-background">
      {/* Background effects */}
      <div className="absolute inset-0 bg-hero-pattern opacity-30" />
      <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-primary/20 blur-[128px]" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-accent/20 blur-[128px]" />
      

      <div className="container relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-20">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-sm"
        >
          <img src="/logo.png" alt="IntraView AI" className="h-4 w-4 rounded object-contain" />
          <span className="text-sm font-medium">AI-Powered Interview Platform</span>
        </motion.div>

        {/* Main headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-6 max-w-4xl text-center text-5xl font-bold leading-tight md:text-6xl lg:text-7xl"
        >
          <span className="gradient-text">The Future</span> of
          <br />
          AI Interviewing
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-10 max-w-2xl text-center text-lg text-muted-foreground md:text-xl"
        >
          Experience intelligent, automated interviews powered by cutting-edge AI.
          Get instant feedback, detailed analytics, and personalized recommendations.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col gap-4 sm:flex-row"
        >
          <Button asChild size="lg" className="btn-primary gap-2 px-8 text-lg">
            <Link to="/auth">
              Start as Candidate
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="gap-2 px-8 text-lg">
            <Link to="/admin/login">
              Admin Login
            </Link>
          </Button>
        </motion.div>


      </div>
    </section>
  );
}

export function Features() {
  const features = [
    {
      icon: Brain,
      title: 'AI Analysis',
      description: 'Advanced natural language processing evaluates responses in real-time, providing nuanced assessment of technical knowledge and communication skills.',
      gradient: 'from-primary to-purple-500',
    },
    {
      icon: Code,
      title: 'Code Sandbox',
      description: 'Integrated coding environment with support for multiple languages, real-time execution, and intelligent plagiarism detection.',
      gradient: 'from-accent to-cyan-400',
    },
    {
      icon: MessageSquare,
      title: 'Behavioral Scoring',
      description: 'Sophisticated analysis of soft skills, communication patterns, and cultural fit indicators through conversational AI.',
      gradient: 'from-orange-500 to-pink-500',
    },
  ];

  return (
    <section className="relative py-24">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
      
      <div className="container relative z-10 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-16 text-center"
        >
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">Powerful Features</h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Everything you need to conduct professional, AI-powered interviews at scale.
          </p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-3">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -10, scale: 1.02 }}
              className="glass-card group p-8"
            >
              <div className={`mb-6 inline-flex rounded-xl bg-gradient-to-br ${feature.gradient} p-4 shadow-lg`}>
                <feature.icon className="h-8 w-8 text-white" />
              </div>
              <h3 className="mb-3 text-xl font-semibold">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/50 py-12">
      <div className="container px-4">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="IntraView AI" className="h-8 w-8 rounded-lg object-contain" />
            <span className="text-lg font-bold">IntraView AI</span>
          </div>
          
          <nav className="flex gap-8">
            <Link to="/auth" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Get Started
            </Link>
            <Link to="/admin/login" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Admin
            </Link>
          </nav>

          <p className="text-sm text-muted-foreground">
            © 2024 IntraView AI. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
