package PDF::API2::Content::MultiParagraph;

use strict;
use warnings;

# This module extends PDF::API2::Content with paragraph_multi
package PDF::API2::Content;

use Carp;

=item ($overflow, $height) = $content->paragraph_multi($text_data, $width, $height, %options)

Apply mixed-style text within a rectangle and return any leftover text.

C<$text_data> is a hash reference:
    {
        textElements => [
            { text => '...', font => $f, fontSize => $s, color => $c },
            ...
        ],
        defaultStyle => { font => $f, fontSize => $s, color => $c }
    }

C<color> can be a name or an array reference (RGB/CMYK).
C<font> is a PDF::API2::Font object.

Options:
-align => 'left', 'center', 'right', 'justified'
-leading => distance between lines (default: $self->lead)

=cut

sub paragraph_multi {
    my ($self, $text_data, $width, $height, %opts) = @_;
    
    my $text_elements = $text_data->{textElements} || [];
    my $default_style = $text_data->{defaultStyle} || {};
    
    # Pre-process elements into tokens (words and spaces)
    my @tokens;
    foreach my $el (@$text_elements) {
        my %style = (%$default_style, %$el);
        my $text = delete $style{text};
        next unless defined $text;
        
        # Split by whitespace but preserve it
        my @parts = split(/(\s+)/, $text);
        foreach my $p (@parts) {
            next if length($p) == 0;
            push @tokens, { text => $p, style => \%style };
        }
    }
    
    my $lead = $opts{-leading} || $self->lead() || 12;
    $self->lead($lead); # Crucial: set the lead on the object so nl() works
    my $remaining_height = $height;
    
    while (@tokens) {
        if (($remaining_height -= $lead) < 0) {
            last;
        }
        
        my @line_tokens;
        my $line_width = 0;
        
        # Greedy line filling
        while (@tokens) {
            my $token = $tokens[0];
            # advancewidth factors in font, fontsize, hspace, etc.
            my $w = $self->advancewidth($token->{text}, 
                font => $token->{style}->{font}, 
                fontsize => $token->{style}->{fontSize}
            );
            
            if ($line_width + $w <= $width || @line_tokens == 0) {
                $line_width += $w;
                push @line_tokens, shift @tokens;
            } else {
                last;
            }
        }
        
        # Strip trailing whitespace for alignment calculations
        while (@line_tokens > 1 && $line_tokens[-1]->{text} =~ /^\s+$/) {
            my $t = pop @line_tokens;
            my $w = $self->advancewidth($t->{text}, 
                font => $t->{style}->{font}, 
                fontsize => $t->{style}->{fontSize}
            );
            $line_width -= $w;
            unshift @tokens, $t;
        }

        # Alignment
        my $offset = 0;
        my $old_hspace = $self->hspace || 100;
        my $align = $opts{-align} || '';
        
        if ($align =~ /^c/i) {
            $offset = ($width - $line_width) / 2;
        } elsif ($align =~ /^r/i) {
            $offset = $width - $line_width;
        } elsif ($align =~ /^j/i && @tokens) {
            # Justify if not the last line
            if ($line_width > 0 && $line_width < $width) {
                $self->hspace($old_hspace * ($width / $line_width));
            }
        }
        
        if ($offset != 0) {
            $self->distance($offset, 0);
        }
        
        # Render tokens
        foreach my $t (@line_tokens) {
            $self->font($t->{style}->{font}, $t->{style}->{fontSize});
            if ($t->{style}->{color}) {
                $self->fillcolor(ref($t->{style}->{color}) ? @{$t->{style}->{color}} : $t->{style}->{color});
            }
            $self->text($t->{text});
        }
        
        # Reset state
        if ($offset != 0) {
            $self->distance(-$offset, 0);
        }
        if ($align =~ /^j/i) {
            $self->hspace($old_hspace);
        }
        
        $self->nl;
    }
    
    # Re-assemble overflow
    my @overflow_elements;
    if (@tokens) {
        my $current_el = undef;
        foreach my $t (@tokens) {
            my $style = $t->{style};
            if ($current_el && 
                $current_el->{font} == $style->{font} && 
                $current_el->{fontSize} == $style->{fontSize} &&
                ($current_el->{color} || '') eq ($style->{color} || '')) {
                $current_el->{text} .= $t->{text};
            } else {
                $current_el = {
                    text => $t->{text},
                    font => $style->{font},
                    fontSize => $style->{fontSize},
                    color => $style->{color},
                };
                push @overflow_elements, $current_el;
            }
        }
    }
    
    my $overflow = {
        textElements => \@overflow_elements,
        defaultStyle => $default_style,
    };
    
    if (wantarray) {
        return ($overflow, $remaining_height);
    }
    return $overflow;
}

1;
