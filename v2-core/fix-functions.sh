#!/bin/bash

# Fix all the "return data}))" to "return data})))" issues
cd functions

for file in *.ts; do
    if grep -q "return data" "$file"; then
        # Check if it has the incorrect pattern
        if grep -q "return data" "$file" | grep -q "))"; then
            echo "Fixing $file"
            # Use perl to fix the pattern
            perl -i -pe 's/return data\s*\)\)\)/return data\}\)\)\)/g' "$file"
        fi
    fi
done

echo "Done fixing functions"
