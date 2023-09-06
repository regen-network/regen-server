# Background

Occasionally we need to manually update a profile in the database.
Typically these are profiles for multi-sig addresses which currently cannot create a profile through the application.
There are scenarios that this document will walk through:

1. Creating a new account and profile
2. Updating an already existing profile

# Creating a new account and profile

## Step 1: creating an account for an address

If you need a user type account:

```sql
SELECT * FROM private.create_new_account('regen12345', 'user');
```

If you need an organization type account:

```sql
SELECT * FROM private.create_new_account('regen12345', 'organization');
```

## Step 2: Finding the profile id for an address

```sql
SELECT party.id FROM party JOIN wallet ON party.wallet_id = wallet.id WHERE wallet.addr = 'regen12345';
```

```
                  id
--------------------------------------
 997ea872-4c59-11ee-98a7-c26700a3bae4
(1 row)
```

## Step 3: updating the profile for the new account

```sql
UPDATE
  party
SET
  name = 'Name',
  description = '160 character description',
  image = 'url to profile image',
  bg_image = 'url to background image',
  twitter_link = 'twitter link',
  website_link = 'website link'
WHERE
  party_id = '997ea872-4c59-11ee-98a7-c26700a3bae4';
```

# Updating an already existing profile

## Step 1: Finding the profile id for an address

```sql
SELECT party.id FROM party JOIN wallet ON party.wallet_id = wallet.id WHERE wallet.addr = 'regen12345';
```

```
                  id
--------------------------------------
 997ea872-4c59-11ee-98a7-c26700a3bae4
(1 row)
```

## Step 2: Updating the profile

```sql
UPDATE
  party
SET
  name = 'Name',
  description = '160 character description',
  image = 'url to profile image',
  bg_image = 'url to background image',
  twitter_link = 'twitter link',
  website_link = 'website link'
WHERE
  party_id = '997ea872-4c59-11ee-98a7-c26700a3bae4';
```

# Profile image and background image

For all profiles created and managed in the app, the profile image and the background image are stored in S3.
Therefore part of the manual process is uploading these images into S3.
These images are typically given to use by Erika since they usually are custom designed.
The same applies for all of the other fields for the profile, they are given by Erika.

The images must be uploaded to the `regen-registry` bucket, within the `profiles` folder.
Within the `profiles` folder, we create a folder whose name equals the `party_id` for the profile.
The profile image and the background image can be uploaded within the newly created folder with any name.
Then you can copy the URL to the file, it will be publically available by default based on the configuration of the `profiles` folder.
These URLs are what can be used in the `party.image` and `party.bg_image` fields.

# Testing profile changes

Regardless of which scenario you are working with, it is best practice to first do the process in the staging environment and then do the process in the production environment.
After completing these changes you can check the results.

For staging:

- https://dev.app.regen.network/profiles/regen12345

For production:

- https://app.regen.network/profiles/regen12345
