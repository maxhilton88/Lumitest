/**
 * ContactPage.tsx — Contact Information
 * 
 * Route: /contact
 * Address, WhatsApp, email, working hours, contact form.
 */
import React, { useState } from 'react';
import { MapPin, MessageCircle, Mail, Clock, ArrowRight, Sparkles, Send } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner@2.0.3';

export function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sending, setSending] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    // Simulate send — in production this would hit a server endpoint
    setTimeout(() => {
      toast.success('Message sent! We\'ll get back to you within 24 hours.');
      setForm({ name: '', email: '', message: '' });
      setSending(false);
    }, 1000);
  };

  const CONTACT_INFO = [
    {
      icon: MapPin,
      label: 'Address',
      value: '88, Jalan Raja Chulan,\nBukit Bintang, 50200\nKuala Lumpur, Malaysia',
      href: 'https://maps.google.com/?q=88+Jalan+Raja+Chulan+Kuala+Lumpur',
    },
    {
      icon: MessageCircle,
      label: 'WhatsApp',
      value: '+6018-2793151',
      href: 'https://wa.me/60182793151',
    },
    {
      icon: Mail,
      label: 'Email',
      value: 'hello@projectlumi.org',
      href: 'mailto:hello@projectlumi.org',
    },
    {
      icon: Clock,
      label: 'Working Hours',
      value: 'Monday - Friday\n8:00 AM - 5:00 PM',
      href: undefined,
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gray-50/80 to-white pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-16 sm:pt-24 sm:pb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-2xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full mb-6">
              <Sparkles className="w-3 h-3 text-gray-500" />
              <span className="text-[11px] font-medium text-gray-600 uppercase tracking-wider">
                Contact Us
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-bold text-gray-950 tracking-tight leading-[1.15] mb-5">
              Get in touch
            </h1>

            <p className="text-base sm:text-lg text-gray-500 leading-relaxed">
              Have a question about Project Lumi? Want to partner as a kindergarten?
              We'd love to hear from you.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ─── CONTACT INFO + FORM ─── */}
      <section className="border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Contact cards */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-xl font-bold text-gray-950 tracking-tight mb-6">
                Contact information
              </h2>

              <div className="grid sm:grid-cols-2 lg:grid-cols-1 gap-4">
                {CONTACT_INFO.map((info, i) => {
                  const Icon = info.icon;
                  const Wrapper = info.href ? 'a' : 'div';
                  return (
                    <motion.div
                      key={info.label}
                      initial={{ opacity: 0, y: 12 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: i * 0.08 }}
                    >
                      <Wrapper
                        {...(info.href ? { href: info.href, target: '_blank', rel: 'noopener noreferrer' } : {})}
                        className="block p-5 rounded-2xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50/50 transition-all group"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-gray-950 transition-colors">
                            <Icon className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                          </div>
                          <div>
                            <div className="text-[10px] font-semibold text-gray-300 uppercase tracking-wider mb-1">
                              {info.label}
                            </div>
                            <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                              {info.value}
                            </div>
                          </div>
                        </div>
                      </Wrapper>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            {/* Contact form */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-xl font-bold text-gray-950 tracking-tight mb-6">
                Send us a message
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">
                    Name
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 transition-colors placeholder:text-gray-300"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 transition-colors placeholder:text-gray-300"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">
                    Message
                  </label>
                  <textarea
                    required
                    rows={5}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 transition-colors placeholder:text-gray-300 resize-none"
                    placeholder="How can we help you?"
                  />
                </div>
                <button
                  type="submit"
                  disabled={sending}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 bg-gray-950 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-all disabled:opacity-50"
                >
                  {sending ? 'Sending...' : 'Send Message'}
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
